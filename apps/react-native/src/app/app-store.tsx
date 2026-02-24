import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  GatewaySessionManager,
  type CapabilityConfig,
  type ConnectionPhase,
} from '../gateway/sessions';
import { buildGatewayUrl, decodeSetupCode } from '../gateway/setup-code';
import type {
  ChatHistoryResponse,
  ModelsListResponse,
  ChatSendResponse,
  GatewayChatEventPayload,
  GatewayHelloOk,
  SessionsListResponse,
  TalkModeParams,
} from '../gateway/protocol';
import { GatewayRequestError } from '../gateway/client';

type ChatRole = 'user' | 'assistant' | 'system';

type SessionDefaults = {
  defaultAgentId: string;
  mainKey: string;
  mainSessionKey: string;
  scope?: string;
};

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
  chatError: string | null;
  gatewayConfig: GatewayConfigState;
  sessionDefaults: SessionDefaults | null;
  sessionKey: string;
  sessionOptions: string[];
  modelOptions: string[];
  selectedModel: string | null;
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
  clearChatError: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshHistory: () => Promise<void>;
  refreshModels: () => Promise<void>;
  sendChatMessage: (text: string) => Promise<void>;
  startNewSession: () => Promise<void>;
  selectModel: (modelRef: string) => Promise<void>;
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
  chatError: null,
  gatewayConfig: {
    host: '127.0.0.1',
    port: '18789',
    tls: false,
    token: '',
    password: '',
    setupCode: '',
  },
  sessionDefaults: null,
  sessionKey: 'main',
  sessionOptions: ['main'],
  modelOptions: [],
  selectedModel: null,
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
const gatewayConfigStorageKey = 'openclaw.mobile.gateway.config.v1';
const gatewaySecretsStorageKey = 'openclaw.mobile.gateway.secrets.v1';

function nowId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function parseStoredGatewayConfig(raw: string | null): Partial<GatewayConfigState> | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<GatewayConfigState>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const next: Partial<GatewayConfigState> = {};

    if (typeof parsed.host === 'string' && parsed.host.trim().length > 0) {
      next.host = parsed.host.trim();
    }

    if (typeof parsed.port === 'string') {
      const port = Number(parsed.port);
      if (Number.isInteger(port) && port > 0 && port <= 65535) {
        next.port = String(port);
      }
    }

    if (typeof parsed.tls === 'boolean') {
      next.tls = parsed.tls;
    }

    if (typeof parsed.token === 'string') {
      next.token = parsed.token;
    }

    if (typeof parsed.password === 'string') {
      next.password = parsed.password;
    }

    return Object.keys(next).length > 0 ? next : null;
  } catch {
    return null;
  }
}

function parseStoredGatewaySecrets(raw: string | null): Partial<GatewayConfigState> | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<GatewayConfigState>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const next: Partial<GatewayConfigState> = {};

    if (typeof parsed.token === 'string') {
      next.token = parsed.token;
    }

    if (typeof parsed.password === 'string') {
      next.password = parsed.password;
    }

    return Object.keys(next).length > 0 ? next : null;
  } catch {
    return null;
  }
}

function resolveChatRole(rawRole: unknown, fallback: ChatRole = 'assistant'): ChatRole {
  const normalized = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : '';
  if (normalized === 'user' || normalized === 'assistant' || normalized === 'system') {
    return normalized;
  }
  return fallback;
}

function extractTextFromMessageObject(item: Record<string, unknown>): string {
  const content = item.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    const chunks = content
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const candidate = entry as Record<string, unknown>;
        if (candidate.type === 'text' && typeof candidate.text === 'string') {
          return candidate.text;
        }
        if (typeof candidate.text === 'string') {
          return candidate.text;
        }
        return null;
      })
      .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
    if (chunks.length > 0) {
      return chunks.join('\n');
    }
  }
  if (typeof item.text === 'string') {
    return item.text;
  }
  if (typeof item.errorMessage === 'string') {
    const error = item.errorMessage.trim();
    if (error.length > 0) {
      return error.toLowerCase().startsWith('error:') ? error : `Error: ${error}`;
    }
  }
  return '';
}

function mapHistoryMessage(raw: unknown, index: number): ChatMessage | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const item = raw as Record<string, unknown>;
  const role = resolveChatRole(item.role);
  const text = extractTextFromMessageObject(item);
  if (!text.trim()) {
    return null;
  }

  const timestamp = typeof item.timestamp === 'number' ? item.timestamp : Date.now();

  return {
    id: nowId(`history-${index}`),
    role,
    text,
    timestamp,
  };
}

function parseSessionDefaults(hello: GatewayHelloOk): SessionDefaults | null {
  const defaults = hello.snapshot?.sessionDefaults;
  if (!defaults) {
    return null;
  }

  const defaultAgentId = typeof defaults.defaultAgentId === 'string' ? defaults.defaultAgentId.trim() : '';
  const mainKey = typeof defaults.mainKey === 'string' ? defaults.mainKey.trim() : '';
  const mainSessionKey = typeof defaults.mainSessionKey === 'string' ? defaults.mainSessionKey.trim() : '';
  if (!defaultAgentId || !mainKey || !mainSessionKey) {
    return null;
  }

  const scope = typeof defaults.scope === 'string' ? defaults.scope.trim() : '';
  return {
    defaultAgentId,
    mainKey,
    mainSessionKey,
    scope: scope || undefined,
  };
}

function normalizeSessionKeyForDefaults(value: string, defaults: SessionDefaults | null): string {
  const raw = value.trim();
  if (!raw) {
    return raw;
  }
  if (!defaults?.mainSessionKey) {
    return raw;
  }
  const isAlias =
    raw === 'main' ||
    raw === defaults.mainKey ||
    raw === `agent:${defaults.defaultAgentId}:main` ||
    raw === `agent:${defaults.defaultAgentId}:${defaults.mainKey}`;
  return isAlias ? defaults.mainSessionKey : raw;
}

function sessionKeysMatch(left: string, right: string, defaults: SessionDefaults | null): boolean {
  const normalizedLeft = normalizeSessionKeyForDefaults(left, defaults);
  const normalizedRight = normalizeSessionKeyForDefaults(right, defaults);
  if (normalizedLeft === normalizedRight) {
    return true;
  }
  if (!defaults) {
    return (
      (normalizedLeft === 'main' && normalizedRight === 'agent:main:main') ||
      (normalizedLeft === 'agent:main:main' && normalizedRight === 'main')
    );
  }
  return false;
}

function normalizeSessionOptions(options: string[], defaults: SessionDefaults | null): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const option of options) {
    const candidate = normalizeSessionKeyForDefaults(option, defaults);
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    normalized.push(candidate);
  }
  return normalized;
}

function resolveSessionKeyForRequest(state: AppState): string {
  return normalizeSessionKeyForDefaults(state.sessionKey, state.sessionDefaults) || state.sessionKey;
}

function dedupeChatMessages(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  const deduped: ChatMessage[] = [];
  for (const message of messages) {
    const text = message.text.trim();
    const key = `${message.role}|${message.timestamp}|${text}`;
    if (seen.has(key)) {
      continue;
    }
    const previous = deduped[deduped.length - 1];
    if (previous) {
      const previousText = previous.text.trim();
      const nearDuplicateWindowMs = 30_000;
      const closeInTime = Math.abs(message.timestamp - previous.timestamp) <= nearDuplicateWindowMs;
      if (
        message.role === previous.role &&
        message.role !== 'user' &&
        text.length > 0 &&
        text === previousText &&
        closeInTime
      ) {
        continue;
      }
    }
    seen.add(key);
    deduped.push(message);
  }
  return deduped;
}

function formatModelRef(provider: unknown, model: unknown): string | null {
  const normalizedProvider = typeof provider === 'string' ? provider.trim() : '';
  const normalizedModel = typeof model === 'string' ? model.trim() : '';
  if (!normalizedProvider || !normalizedModel) {
    return null;
  }
  return `${normalizedProvider}/${normalizedModel}`;
}

function shouldReloadHistoryForChatTerminal(payload: GatewayChatEventPayload, state: AppState): boolean {
  if (payload.state !== 'final' && payload.state !== 'aborted') {
    return false;
  }
  if (!sessionKeysMatch(payload.sessionKey, state.sessionKey, state.sessionDefaults)) {
    return false;
  }
  return true;
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
  const gatewayConfigHydratedRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      AsyncStorage.getItem(gatewayConfigStorageKey),
      SecureStore.getItemAsync(gatewaySecretsStorageKey),
    ])
      .then(([configRaw, secretsRaw]) => {
        if (cancelled) {
          return;
        }

        const storedConfig = parseStoredGatewayConfig(configRaw);
        const storedSecrets = parseStoredGatewaySecrets(secretsRaw);
        if (!storedConfig && !storedSecrets) {
          return;
        }

        setState((prev) => {
          const next: AppState = {
            ...prev,
            gatewayConfig: {
              ...prev.gatewayConfig,
              ...storedConfig,
              ...storedSecrets,
            },
          };
          stateRef.current = next;
          return next;
        });
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to restore gateway config', error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          gatewayConfigHydratedRef.current = true;
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!gatewayConfigHydratedRef.current) {
      return;
    }

    const payload: GatewayConfigState = {
      ...state.gatewayConfig,
      token: '',
      password: '',
      setupCode: '',
    };

    void AsyncStorage.setItem(gatewayConfigStorageKey, JSON.stringify(payload)).catch((error) => {
      console.error('Failed to persist gateway config', error);
    });

    const secrets = {
      token: state.gatewayConfig.token,
      password: state.gatewayConfig.password,
    };

    if (!secrets.token && !secrets.password) {
      void SecureStore.deleteItemAsync(gatewaySecretsStorageKey).catch((error) => {
        console.error('Failed to clear gateway secrets', error);
      });
      return;
    }

    void SecureStore.setItemAsync(gatewaySecretsStorageKey, JSON.stringify(secrets)).catch((error) => {
      console.error('Failed to persist gateway secrets', error);
    });
  }, [
    state.gatewayConfig.host,
    state.gatewayConfig.port,
    state.gatewayConfig.tls,
    state.gatewayConfig.token,
    state.gatewayConfig.password,
  ]);

  const managerRef = useRef<GatewaySessionManager | null>(null);
  const loadChatHistory = async (options?: { showLoading?: boolean; quiet?: boolean }) => {
    const manager = managerRef.current;
    const client = manager?.getOperatorClient();
    if (!client) {
      return;
    }

    const showLoading = options?.showLoading ?? true;
    const quiet = options?.quiet ?? false;
    const requestSessionKey = resolveSessionKeyForRequest(stateRef.current);

    if (showLoading) {
      setState((prev) => {
        const next: AppState = { ...prev, chatLoading: true, chatError: null };
        stateRef.current = next;
        return next;
      });
    }
    try {
      const response = await client.request<ChatHistoryResponse>('chat.history', {
        sessionKey: requestSessionKey,
        limit: 200,
      });
      const mapped = (response.messages ?? [])
        .map((entry, index) => mapHistoryMessage(entry, index))
        .filter((entry): entry is ChatMessage => entry !== null);
      const deduped = dedupeChatMessages(mapped);

      setState((prev) => {
        const next: AppState = {
          ...prev,
          sessionKey: normalizeSessionKeyForDefaults(prev.sessionKey, prev.sessionDefaults) || prev.sessionKey,
          chatMessages: deduped.length > 0 ? deduped : prev.chatMessages,
          chatLoading: showLoading ? false : prev.chatLoading,
          chatError: quiet ? prev.chatError : null,
        };
        stateRef.current = next;
        return next;
      });
    } catch (error) {
      if (quiet) {
        if (showLoading) {
          setState((prev) => {
            const next: AppState = { ...prev, chatLoading: false };
            stateRef.current = next;
            return next;
          });
        }
        return;
      }
      const message = normalizeGatewayMessage(error);
      setState((prev) => {
        const next: AppState = {
          ...prev,
          chatLoading: false,
          statusText: message,
          chatError: message,
        };
        stateRef.current = next;
        return next;
      });
    }
  };

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
        const shouldReloadHistory = shouldReloadHistoryForChatTerminal(payload, stateRef.current);
        setState((prev) => {
          const next = applyChatEvent(prev, payload);
          stateRef.current = next;
          return next;
        });
        if (shouldReloadHistory) {
          void loadChatHistory({ showLoading: false, quiet: true });
        }
      },
      onHello: (hello, role) => {
        if (role !== 'operator') {
          return;
        }
        const defaults = parseSessionDefaults(hello);
        if (!defaults) {
          return;
        }
        setState((prev) => {
          const nextSessionKey =
            normalizeSessionKeyForDefaults(prev.sessionKey, defaults) || prev.sessionKey;
          const normalizedOptions = normalizeSessionOptions(prev.sessionOptions, defaults);
          const nextOptions = normalizedOptions.includes(nextSessionKey)
            ? normalizedOptions
            : [nextSessionKey, ...normalizedOptions];
          const next: AppState = {
            ...prev,
            sessionDefaults: defaults,
            sessionKey: nextSessionKey,
            sessionOptions: nextOptions.length > 0 ? nextOptions : [nextSessionKey],
          };
          stateRef.current = next;
          return next;
        });
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

      clearChatError: () => {
        setState((prev) => {
          if (!prev.chatError) {
            return prev;
          }
          return {
            ...prev,
            chatError: null,
          };
        });
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
          await refreshModels();
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
          chatError: null,
        }));
      },

      refreshHistory: async () => {
        await loadChatHistory({ showLoading: true, quiet: false });
      },

      refreshModels: async () => {
        await refreshModels();
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
          chatError: null,
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
          const requestSessionKey = resolveSessionKeyForRequest(stateRef.current);
          const response = await client.request<ChatSendResponse>('chat.send', {
            sessionKey: requestSessionKey,
            message,
            deliver: false,
            timeoutMs: 30000,
            idempotencyKey: runId,
          }, 35_000);
          const actualRunId =
            response && typeof response.runId === 'string' ? response.runId.trim() : '';
          if (actualRunId && actualRunId !== runId) {
            setState((prev) => {
              if (prev.chatRunId !== runId) {
                return prev;
              }
              return {
                ...prev,
                chatRunId: actualRunId,
              };
            });
          }
        } catch (error) {
          const message = normalizeGatewayMessage(error);
          setState((prev) => ({
            ...prev,
            chatRunId: null,
            chatStream: '',
            chatError: message,
            chatMessages: [
              ...prev.chatMessages,
              {
                id: nowId('chat-error'),
                role: 'assistant',
                text: `Error: ${message}`,
                timestamp: Date.now(),
              },
            ],
            statusText: message,
          }));
        } finally {
          setState((prev) => ({
            ...prev,
            chatSending: false,
          }));
        }
      },

      startNewSession: async () => {
        const manager = managerRef.current;
        const client = manager?.getOperatorClient();
        if (!client) {
          return;
        }

        const runId = nowId('run-new');
        const requestSessionKey = resolveSessionKeyForRequest(stateRef.current);

        setState((prev) => ({
          ...prev,
          chatSending: true,
          chatRunId: runId,
          chatStream: '',
          chatError: null,
          statusText: 'Starting new session…',
        }));

        try {
          const response = await client.request<ChatSendResponse>('chat.send', {
            sessionKey: requestSessionKey,
            message: '/new',
            deliver: false,
            timeoutMs: 30000,
            idempotencyKey: runId,
          }, 35_000);
          const actualRunId =
            response && typeof response.runId === 'string' ? response.runId.trim() : '';
          if (actualRunId && actualRunId !== runId) {
            setState((prev) => {
              if (prev.chatRunId !== runId) {
                return prev;
              }
              return {
                ...prev,
                chatRunId: actualRunId,
              };
            });
          }
          await refreshSessions();
        } catch (error) {
          const message = normalizeGatewayMessage(error);
          setState((prev) => ({
            ...prev,
            chatRunId: null,
            chatStream: '',
            chatError: message,
            statusText: message,
          }));
        } finally {
          setState((prev) => ({
            ...prev,
            chatSending: false,
          }));
        }
      },

      selectModel: async (modelRef) => {
        const selected = modelRef.trim();
        if (!selected) {
          return;
        }

        const manager = managerRef.current;
        const client = manager?.getOperatorClient();
        if (!client) {
          return;
        }

        const runId = nowId('run-model');
        const requestSessionKey = resolveSessionKeyForRequest(stateRef.current);

        setState((prev) => ({
          ...prev,
          chatSending: true,
          chatRunId: runId,
          chatStream: '',
          chatError: null,
          selectedModel: selected,
        }));

        try {
          const response = await client.request<ChatSendResponse>('chat.send', {
            sessionKey: requestSessionKey,
            message: `/model ${selected}`,
            deliver: false,
            timeoutMs: 30000,
            idempotencyKey: runId,
          }, 35_000);
          const actualRunId =
            response && typeof response.runId === 'string' ? response.runId.trim() : '';
          if (actualRunId && actualRunId !== runId) {
            setState((prev) => {
              if (prev.chatRunId !== runId) {
                return prev;
              }
              return {
                ...prev,
                chatRunId: actualRunId,
              };
            });
          }
          await refreshSessions();
        } catch (error) {
          const message = normalizeGatewayMessage(error);
          setState((prev) => ({
            ...prev,
            chatRunId: null,
            chatStream: '',
            chatError: message,
            statusText: message,
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

        setState((prev) => ({ ...prev, chatSending: true, chatError: null }));
        try {
          const requestSessionKey = resolveSessionKeyForRequest(stateRef.current);
          await client.request('chat.abort', {
            sessionKey: requestSessionKey,
            runId: stateRef.current.chatRunId ?? undefined,
          });
          setState((prev) => ({
            ...prev,
            chatRunId: null,
            chatStream: '',
            chatSending: false,
            chatError: null,
          }));
        } catch (error) {
          const message = normalizeGatewayMessage(error);
          setState((prev) => ({
            ...prev,
            chatSending: false,
            statusText: message,
            chatError: message,
          }));
        }
      },

      setSessionKey: (sessionKey) => {
        const current = stateRef.current;
        const nextKey =
          normalizeSessionKeyForDefaults(sessionKey.trim() || 'main', current.sessionDefaults) || 'main';
        setState((prev) => {
          const next: AppState = {
            ...prev,
            sessionKey: nextKey,
          };
          stateRef.current = next;
          return next;
        });
        void refreshSessions();
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
        const normalized = normalizeSessionOptions(options, stateRef.current.sessionDefaults);
        const sessionRows = response.sessions ?? [];

        setState((prev) => ({
          ...prev,
          sessionKey:
            normalizeSessionKeyForDefaults(prev.sessionKey, prev.sessionDefaults) || prev.sessionKey,
          sessionOptions: (() => {
            const candidate = normalized.length > 0 ? normalized : prev.sessionOptions;
            const currentKey =
              normalizeSessionKeyForDefaults(prev.sessionKey, prev.sessionDefaults) || prev.sessionKey;
            return candidate.includes(currentKey) ? candidate : [currentKey, ...candidate];
          })(),
          selectedModel: (() => {
            const currentKey =
              normalizeSessionKeyForDefaults(prev.sessionKey, prev.sessionDefaults) || prev.sessionKey;
            const currentRow = sessionRows.find((session) => {
              const key = typeof session.key === 'string' ? session.key : '';
              return key.length > 0 && sessionKeysMatch(key, currentKey, prev.sessionDefaults);
            });
            const currentModel = formatModelRef(currentRow?.modelProvider, currentRow?.model);
            return currentModel ?? prev.selectedModel;
          })(),
        }));
      } catch {
        // Best effort; no fallback path needed.
      }
    }

    async function refreshModels() {
      const manager = managerRef.current;
      const client = manager?.getOperatorClient();
      if (!client) {
        return;
      }

      try {
        const response = await client.request<ModelsListResponse>('models.list', {});
        const nextOptions = (response.models ?? [])
          .map((entry) => formatModelRef(entry.provider, entry.id))
          .filter((entry): entry is string => Boolean(entry));
        const uniqueOptions = Array.from(new Set(nextOptions));

        setState((prev) => ({
          ...prev,
          modelOptions: uniqueOptions.length > 0 ? uniqueOptions : prev.modelOptions,
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
  if (!sessionKeysMatch(payload.sessionKey, state.sessionKey, state.sessionDefaults)) {
    return state;
  }
  const isForeignRun = Boolean(payload.runId && state.chatRunId && payload.runId !== state.chatRunId);

  if (payload.state === 'delta') {
    if (isForeignRun) {
      return state;
    }
    const text =
      payload.message && typeof payload.message === 'object'
        ? extractTextFromMessageObject(payload.message as Record<string, unknown>) || state.chatStream
        : state.chatStream;
    return {
      ...state,
      chatStream: text,
      chatError: null,
    };
  }

  if (payload.state === 'final') {
    if (isForeignRun) {
      return {
        ...state,
        chatError: null,
      };
    }

    return {
      ...state,
      chatStream: '',
      chatRunId: null,
      chatSending: false,
      chatError: null,
    };
  }

  if (payload.state === 'aborted') {
    if (isForeignRun) {
      return state;
    }

    return {
      ...state,
      chatStream: '',
      chatRunId: null,
      chatSending: false,
      chatError: null,
    };
  }

  if (payload.state === 'error') {
    if (isForeignRun) {
      return state;
    }
    const errorMessage = payload.errorMessage ?? 'Chat error';
    return {
      ...state,
      chatStream: '',
      chatRunId: null,
      chatSending: false,
      statusText: errorMessage,
      chatError: errorMessage,
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
