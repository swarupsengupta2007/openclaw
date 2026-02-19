import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  GatewaySessionManager,
  type CapabilityConfig,
  type ConnectionPhase,
} from '../gateway/sessions';
import { extractAssistantText } from '../gateway/chat-text';
import { buildGatewayUrl, decodeSetupCode } from '../gateway/setup-code';
import type {
  ChatHistoryResponse,
  ChatSendResponse,
  GatewayChatEventPayload,
  SessionsListResponse,
  TalkModeParams,
} from '../gateway/protocol';
import { GatewayRequestError } from '../gateway/client';

type ChatRole = 'user' | 'assistant' | 'system';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: number;
};

export type GatewayConfigState = {
  host: string;
  port: string;
  tls: boolean;
  token: string;
  password: string;
  setupCode: string;
};

export type AppState = {
  phase: ConnectionPhase;
  statusText: string;
  gatewayConfig: GatewayConfigState;
  sessionKey: string;
  sessionOptions: string[];
  chatMessages: ChatMessage[];
  chatStream: string;
  chatLoading: boolean;
  chatSending: boolean;
  chatRunId: string | null;
  talkEnabled: boolean;
  voiceWakeEnabled: boolean;
  cameraEnabled: boolean;
  locationEnabled: boolean;
  reconnectOnLaunch: boolean;
  rawEvents: string[];
};

export type AppActions = {
  setGatewayConfig: (patch: Partial<GatewayConfigState>) => void;
  applySetupCode: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshHistory: () => Promise<void>;
  sendChatMessage: (text: string) => Promise<void>;
  abortRun: () => Promise<void>;
  setSessionKey: (sessionKey: string) => void;
  setTalkEnabled: (enabled: boolean) => Promise<void>;
  setVoiceWakeEnabled: (enabled: boolean) => Promise<void>;
  setCameraEnabled: (enabled: boolean) => Promise<void>;
  setLocationEnabled: (enabled: boolean) => Promise<void>;
  setReconnectOnLaunch: (enabled: boolean) => void;
};

type AppStoreValue = {
  state: AppState;
  actions: AppActions;
};

const initialState: AppState = {
  phase: 'offline',
  statusText: 'Offline',
  gatewayConfig: {
    host: '127.0.0.1',
    port: '18789',
    tls: false,
    token: '',
    password: '',
    setupCode: '',
  },
  sessionKey: 'main',
  sessionOptions: ['main'],
  chatMessages: [
    {
      id: 'welcome',
      role: 'system',
      text: 'Connect to a gateway to start chat.',
      timestamp: Date.now(),
    },
  ],
  chatStream: '',
  chatLoading: false,
  chatSending: false,
  chatRunId: null,
  talkEnabled: false,
  voiceWakeEnabled: false,
  cameraEnabled: true,
  locationEnabled: false,
  reconnectOnLaunch: true,
  rawEvents: [],
};

const AppStoreContext = createContext<AppStoreValue | null>(null);

function nowId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function mapHistoryMessage(raw: unknown, index: number): ChatMessage | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const item = raw as Record<string, unknown>;
  const roleRaw = item.role;
  const role: ChatRole = roleRaw === 'assistant' || roleRaw === 'user' ? roleRaw : 'assistant';

  let text = extractAssistantText(item) ?? '';
  if (!text.trim() && role === 'user') {
    const content = item.content;
    if (Array.isArray(content)) {
      const textBlock = content.find((entry) => {
        if (!entry || typeof entry !== 'object') {
          return false;
        }
        const candidate = entry as Record<string, unknown>;
        return candidate.type === 'text' && typeof candidate.text === 'string';
      }) as { text?: string } | undefined;
      text = textBlock?.text ?? '';
    }
  }

  const timestamp = typeof item.timestamp === 'number' ? item.timestamp : Date.now();
  if (!text.trim()) {
    return null;
  }

  return {
    id: nowId(`history-${index}`),
    role,
    text,
    timestamp,
  };
}

function normalizeGatewayMessage(error: unknown): string {
  if (error instanceof GatewayRequestError) {
    const details = error.details as { requestId?: unknown } | undefined;
    const requestId =
      details && typeof details.requestId === 'string' && details.requestId.trim().length > 0
        ? details.requestId.trim()
        : null;
    const suffix = requestId ? ` (requestId: ${requestId})` : '';
    return `${error.code}: ${error.message}${suffix}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function buildCapabilityConfig(state: AppState): CapabilityConfig {
  return {
    cameraEnabled: state.cameraEnabled,
    locationEnabled: state.locationEnabled,
    voiceWakeEnabled: state.voiceWakeEnabled,
    talkEnabled: state.talkEnabled,
  };
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const stateRef = useRef(state);
  const instanceIdRef = useRef(`rn-${Math.floor(Math.random() * 100_000_000)}`);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const managerRef = useRef<GatewaySessionManager | null>(null);

  if (!managerRef.current) {
    managerRef.current = new GatewaySessionManager({
      onPhaseChange: (phase, message) => {
        setState((prev) => ({
          ...prev,
          phase,
          statusText: message ?? prev.statusText,
        }));
      },
      onChatEvent: (payload) => {
        setState((prev) => applyChatEvent(prev, payload));
      },
      onAgentEvent: (payload) => {
        const note = payload.text?.trim();
        if (!note) {
          return;
        }
        setState((prev) => ({
          ...prev,
          chatMessages: [
            ...prev.chatMessages,
            {
              id: nowId('agent'),
              role: 'system',
              text: note,
              timestamp: Date.now(),
            },
          ],
        }));
      },
      onRawEvent: (event, role) => {
        setState((prev) => {
          const next = [`${role}:${event.event}`, ...prev.rawEvents].slice(0, 20);
          return {
            ...prev,
            rawEvents: next,
          };
        });
      },
    });
  }

  const actions = useMemo<AppActions>(() => {
    return {
      setGatewayConfig: (patch) => {
        const current = stateRef.current;
        const next: AppState = {
          ...current,
          gatewayConfig: {
            ...current.gatewayConfig,
            ...patch,
          },
        };
        stateRef.current = next;
        setState(next);
      },

      applySetupCode: () => {
        const current = stateRef.current;
        const payload = decodeSetupCode(current.gatewayConfig.setupCode);
        if (!payload) {
          const next: AppState = {
            ...current,
            statusText: 'Invalid setup code',
          };
          stateRef.current = next;
          setState(next);
          return;
        }

        const nextConfig = { ...current.gatewayConfig };

        if (payload.url) {
          try {
            const parsed = new URL(payload.url);
            nextConfig.host = parsed.hostname;
            nextConfig.port = parsed.port || (parsed.protocol === 'wss:' ? '443' : '18789');
            nextConfig.tls = parsed.protocol === 'wss:';
          } catch {
            const next: AppState = {
              ...current,
              statusText: 'Setup code URL is invalid',
            };
            stateRef.current = next;
            setState(next);
            return;
          }
        }

        if (payload.host) {
          nextConfig.host = payload.host;
        }
        if (typeof payload.port === 'number') {
          nextConfig.port = String(payload.port);
        }
        if (typeof payload.tls === 'boolean') {
          nextConfig.tls = payload.tls;
        }
        if (payload.token) {
          nextConfig.token = payload.token;
        }
        if (payload.password) {
          nextConfig.password = payload.password;
        }

        const next: AppState = {
          ...current,
          gatewayConfig: nextConfig,
          statusText: 'Setup code applied',
        };
        stateRef.current = next;
        setState(next);
      },

      connect: async () => {
        const manager = managerRef.current;
        if (!manager) {
          return;
        }

        const current = stateRef.current;
        setState((prev) => {
          return {
            ...prev,
            phase: 'connecting',
            statusText: 'Connecting…',
          };
        });

        const port = Number(current.gatewayConfig.port);
        if (!current.gatewayConfig.host.trim() || Number.isNaN(port) || port <= 0 || port > 65535) {
          setState((prev) => ({
            ...prev,
            phase: 'error',
            statusText: 'Invalid host/port',
          }));
          return;
        }

        const url = buildGatewayUrl(current.gatewayConfig.host.trim(), port, current.gatewayConfig.tls);
        const auth = {
          token: current.gatewayConfig.token.trim() || undefined,
          password: current.gatewayConfig.password.trim() || undefined,
        };

        try {
          await manager.connect({
            url,
            auth,
            instanceId: instanceIdRef.current,
            version: '0.1.0',
            capabilityConfig: buildCapabilityConfig(current),
          });
          await actions.refreshHistory();
          await refreshSessions();
        } catch (error) {
          setState((prev) => ({
            ...prev,
            phase: prev.phase === 'pairing_required' || prev.phase === 'auth_required' ? prev.phase : 'error',
            statusText: normalizeGatewayMessage(error),
          }));
        }
      },

      disconnect: () => {
        const manager = managerRef.current;
        manager?.disconnect();
        setState((prev) => ({
          ...prev,
          statusText: 'Offline',
          phase: 'offline',
          chatStream: '',
          chatRunId: null,
        }));
      },

      refreshHistory: async () => {
        const manager = managerRef.current;
        const client = manager?.getOperatorClient();
        if (!client) {
          return;
        }

        setState((prev) => ({ ...prev, chatLoading: true }));
        try {
          const response = await client.request<ChatHistoryResponse>('chat.history', {
            sessionKey: stateRef.current.sessionKey,
            limit: 200,
          });
          const mapped = (response.messages ?? [])
            .map((entry, index) => mapHistoryMessage(entry, index))
            .filter((entry): entry is ChatMessage => entry !== null);
          setState((prev) => ({
            ...prev,
            chatMessages: mapped.length > 0 ? mapped : prev.chatMessages,
            chatLoading: false,
          }));
        } catch (error) {
          setState((prev) => ({
            ...prev,
            chatLoading: false,
            statusText: normalizeGatewayMessage(error),
          }));
        }
      },

      sendChatMessage: async (text) => {
        const message = text.trim();
        if (!message) {
          return;
        }

        const manager = managerRef.current;
        const client = manager?.getOperatorClient();
        if (!client) {
          return;
        }

        const runId = nowId('run');

        setState((prev) => ({
          ...prev,
          chatSending: true,
          chatRunId: runId,
          chatStream: '',
          chatMessages: [
            ...prev.chatMessages,
            {
              id: nowId('user'),
              role: 'user',
              text: message,
              timestamp: Date.now(),
            },
          ],
        }));

        try {
          await client.request<ChatSendResponse>('chat.send', {
            sessionKey: stateRef.current.sessionKey,
            message,
            deliver: false,
            timeoutMs: 30000,
            idempotencyKey: runId,
          }, 35_000);
        } catch (error) {
          setState((prev) => ({
            ...prev,
            chatRunId: null,
            chatStream: '',
            chatMessages: [
              ...prev.chatMessages,
              {
                id: nowId('chat-error'),
                role: 'assistant',
                text: `Error: ${normalizeGatewayMessage(error)}`,
                timestamp: Date.now(),
              },
            ],
            statusText: normalizeGatewayMessage(error),
          }));
        } finally {
          setState((prev) => ({
            ...prev,
            chatSending: false,
          }));
        }
      },

      abortRun: async () => {
        const manager = managerRef.current;
        const client = manager?.getOperatorClient();
        if (!client) {
          return;
        }

        setState((prev) => ({ ...prev, chatSending: true }));
        try {
          await client.request('chat.abort', {
            sessionKey: stateRef.current.sessionKey,
            runId: stateRef.current.chatRunId ?? undefined,
          });
          setState((prev) => ({
            ...prev,
            chatRunId: null,
            chatStream: '',
            chatSending: false,
          }));
        } catch (error) {
          setState((prev) => ({
            ...prev,
            chatSending: false,
            statusText: normalizeGatewayMessage(error),
          }));
        }
      },

      setSessionKey: (sessionKey) => {
        const nextKey = sessionKey.trim() || 'main';
        setState((prev) => ({
          ...prev,
          sessionKey: nextKey,
        }));
      },

      setTalkEnabled: async (enabled) => {
        setState((prev) => ({
          ...prev,
          talkEnabled: enabled,
        }));

        const manager = managerRef.current;
        const client = manager?.getOperatorClient();
        if (!manager || !client) {
          return;
        }

        try {
          const payload: TalkModeParams = { enabled };
          await client.request('talk.mode', payload, 8_000);
          await manager.reconnectWithCapabilities(buildCapabilityConfig({
            ...stateRef.current,
            talkEnabled: enabled,
          }));
        } catch (error) {
          setState((prev) => ({
            ...prev,
            statusText: normalizeGatewayMessage(error),
          }));
        }
      },

      setVoiceWakeEnabled: async (enabled) => {
        setState((prev) => ({
          ...prev,
          voiceWakeEnabled: enabled,
        }));

        const manager = managerRef.current;
        if (manager) {
          await manager.reconnectWithCapabilities(buildCapabilityConfig({ ...stateRef.current, voiceWakeEnabled: enabled }));
        }
      },

      setCameraEnabled: async (enabled) => {
        setState((prev) => ({
          ...prev,
          cameraEnabled: enabled,
        }));

        const manager = managerRef.current;
        if (manager) {
          await manager.reconnectWithCapabilities(buildCapabilityConfig({ ...stateRef.current, cameraEnabled: enabled }));
        }
      },

      setLocationEnabled: async (enabled) => {
        setState((prev) => ({
          ...prev,
          locationEnabled: enabled,
        }));

        const manager = managerRef.current;
        if (manager) {
          await manager.reconnectWithCapabilities(buildCapabilityConfig({ ...stateRef.current, locationEnabled: enabled }));
        }
      },

      setReconnectOnLaunch: (enabled) => {
        setState((prev) => ({
          ...prev,
          reconnectOnLaunch: enabled,
        }));
      },
    };

    async function refreshSessions() {
      const manager = managerRef.current;
      const client = manager?.getOperatorClient();
      if (!client) {
        return;
      }

      try {
        const response = await client.request<SessionsListResponse>('sessions.list', {
          includeGlobal: true,
          includeUnknown: false,
          limit: 100,
        });
        const options = (response.sessions ?? [])
          .map((session) => (typeof session.key === 'string' ? session.key : ''))
          .filter((key): key is string => key.length > 0);

        setState((prev) => ({
          ...prev,
          sessionOptions: options.length > 0 ? options : prev.sessionOptions,
        }));
      } catch {
        // Best effort; no fallback path needed.
      }
    }
  }, []);

  const value = useMemo<AppStoreValue>(
    () => ({
      state,
      actions,
    }),
    [actions, state],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

function applyChatEvent(state: AppState, payload: GatewayChatEventPayload): AppState {
  if (payload.sessionKey !== state.sessionKey) {
    return state;
  }

  if (payload.state === 'delta') {
    const text = extractAssistantText(payload.message) ?? state.chatStream;
    return {
      ...state,
      chatStream: text,
    };
  }

  if (payload.state === 'final') {
    const text = extractAssistantText(payload.message);
    const nextMessages = text?.trim()
      ? [
          ...state.chatMessages,
          {
            id: nowId('assistant'),
            role: 'assistant' as const,
            text,
            timestamp: Date.now(),
          },
        ]
      : state.chatMessages;

    return {
      ...state,
      chatMessages: nextMessages,
      chatStream: '',
      chatRunId: null,
    };
  }

  if (payload.state === 'aborted') {
    const text = extractAssistantText(payload.message);
    const nextMessages = text?.trim()
      ? [
          ...state.chatMessages,
          {
            id: nowId('assistant-abort'),
            role: 'assistant' as const,
            text,
            timestamp: Date.now(),
          },
        ]
      : state.chatMessages;

    return {
      ...state,
      chatMessages: nextMessages,
      chatStream: '',
      chatRunId: null,
      chatSending: false,
    };
  }

  if (payload.state === 'error') {
    return {
      ...state,
      chatStream: '',
      chatRunId: null,
      chatSending: false,
      statusText: payload.errorMessage ?? 'Chat error',
    };
  }

  return state;
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) {
    throw new Error('useAppStore must be used inside AppStoreProvider');
  }
  return ctx;
}
