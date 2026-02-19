import { Platform } from 'react-native';
import { GatewayClient, GatewayRequestError } from './client';
import type {
  GatewayChatEventPayload,
  GatewayClientRole,
  GatewayEventFrame,
  GatewayHelloOk,
  GatewayAgentEventPayload,
} from './protocol';

export type ConnectionPhase =
  | 'offline'
  | 'connecting'
  | 'connected'
  | 'pairing_required'
  | 'auth_required'
  | 'error';

export type GatewayAuthConfig = {
  token?: string;
  password?: string;
};

export type CapabilityConfig = {
  cameraEnabled: boolean;
  locationEnabled: boolean;
  voiceWakeEnabled: boolean;
  talkEnabled: boolean;
};

export type GatewaySessionConnectConfig = {
  url: string;
  auth?: GatewayAuthConfig;
  instanceId: string;
  version: string;
  capabilityConfig: CapabilityConfig;
};

export type SessionEventHandlers = {
  onPhaseChange: (phase: ConnectionPhase, message?: string) => void;
  onChatEvent: (payload: GatewayChatEventPayload) => void;
  onAgentEvent: (payload: GatewayAgentEventPayload) => void;
  onRawEvent?: (event: GatewayEventFrame, role: GatewayClientRole) => void;
};

function includesAny(text: string, needles: string[]): boolean {
  const lower = text.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function classifyConnectionError(error: unknown): ConnectionPhase {
  if (error instanceof GatewayRequestError) {
    const code = error.code.toLowerCase();
    const message = error.message.toLowerCase();

    if (includesAny(code, ['pair']) || includesAny(message, ['pairing', 'approval'])) {
      return 'pairing_required';
    }
    if (
      includesAny(code, ['auth', 'unauthorized']) ||
      includesAny(message, [
        'token',
        'password',
        'unauthorized',
        'device identity',
        'device nonce',
        'device signature',
      ])
    ) {
      return 'auth_required';
    }
  }

  const raw = String(error).toLowerCase();
  if (includesAny(raw, ['pairing', 'approval'])) {
    return 'pairing_required';
  }
  if (includesAny(raw, ['unauthorized', 'token', 'password', 'auth'])) {
    return 'auth_required';
  }

  return 'error';
}

function buildCaps(config: CapabilityConfig): string[] {
  const caps = ['canvas', 'screen', 'device'];
  if (config.cameraEnabled) {
    caps.push('camera');
  }
  if (config.locationEnabled) {
    caps.push('location');
  }
  if (config.voiceWakeEnabled) {
    caps.push('voiceWake');
  }
  return caps;
}

function buildCommands(config: CapabilityConfig): string[] {
  const commands = [
    'canvas.present',
    'canvas.hide',
    'canvas.navigate',
    'canvas.eval',
    'canvas.snapshot',
    'canvas.a2ui.push',
    'canvas.a2ui.pushJSONL',
    'canvas.a2ui.reset',
    'screen.record',
    'system.notify',
    'chat.push',
    'talk.ptt.start',
    'talk.ptt.stop',
    'talk.ptt.cancel',
    'talk.ptt.once',
    'device.status',
    'device.info',
  ];

  if (config.cameraEnabled) {
    commands.push('camera.list', 'camera.snap', 'camera.clip');
  }
  if (config.locationEnabled) {
    commands.push('location.get');
  }

  return commands;
}

function buildPermissions(config: CapabilityConfig): Record<string, boolean> {
  return {
    camera: config.cameraEnabled,
    location: config.locationEnabled,
    voiceWake: config.voiceWakeEnabled,
    talk: config.talkEnabled,
  };
}

function resolveMobileClientId(): 'openclaw-android' | 'openclaw-ios' {
  return Platform.OS === 'ios' ? 'openclaw-ios' : 'openclaw-android';
}

export class GatewaySessionManager {
  private nodeClient: GatewayClient | null = null;
  private operatorClient: GatewayClient | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private desiredConnected = false;
  private paused = false;
  private lastConfig: GatewaySessionConnectConfig | null = null;

  constructor(private readonly handlers: SessionEventHandlers) {}

  async connect(config: GatewaySessionConnectConfig): Promise<void> {
    this.lastConfig = config;
    this.desiredConnected = true;
    this.paused = false;
    this.cancelReconnect();

    this.handlers.onPhaseChange('connecting', 'Connecting to gateway…');

    await this.connectNow(config);
  }

  disconnect(message = 'Disconnected'): void {
    this.desiredConnected = false;
    this.paused = false;
    this.cancelReconnect();

    this.nodeClient?.disconnect();
    this.operatorClient?.disconnect();
    this.nodeClient = null;
    this.operatorClient = null;

    this.handlers.onPhaseChange('offline', message);
  }

  async reconnectWithCapabilities(capabilityConfig: CapabilityConfig): Promise<void> {
    if (!this.lastConfig) {
      return;
    }

    this.lastConfig = {
      ...this.lastConfig,
      capabilityConfig,
    };

    if (!this.desiredConnected) {
      return;
    }

    this.nodeClient?.disconnect();
    this.operatorClient?.disconnect();
    this.nodeClient = null;
    this.operatorClient = null;

    await this.connectNow(this.lastConfig);
  }

  getOperatorClient(): GatewayClient | null {
    return this.operatorClient;
  }

  private async connectNow(config: GatewaySessionConnectConfig): Promise<void> {
    const clientId = resolveMobileClientId();

    const nodeClient = new GatewayClient(config.url, {
      onEvent: (event) => this.handleEvent(event, 'node'),
      onClose: () => this.handleClientClose(),
    });

    const operatorClient = new GatewayClient(config.url, {
      onEvent: (event) => this.handleEvent(event, 'operator'),
      onClose: () => this.handleClientClose(),
    });

    try {
      await nodeClient.connect({
        role: 'node',
        auth: config.auth,
        caps: buildCaps(config.capabilityConfig),
        commands: buildCommands(config.capabilityConfig),
        permissions: buildPermissions(config.capabilityConfig),
        client: {
          id: clientId,
          version: config.version,
          mode: 'node',
          platform: Platform.OS,
          instanceId: config.instanceId,
        },
      });

      await operatorClient.connect({
        role: 'operator',
        scopes: ['operator.read', 'operator.write', 'operator.talk.secrets'],
        auth: config.auth,
        client: {
          id: clientId,
          version: config.version,
          mode: 'ui',
          platform: Platform.OS,
          instanceId: config.instanceId,
        },
      });

      this.nodeClient = nodeClient;
      this.operatorClient = operatorClient;
      this.reconnectAttempts = 0;
      this.handlers.onPhaseChange('connected', 'Connected');
    } catch (error) {
      nodeClient.disconnect();
      operatorClient.disconnect();

      const phase = classifyConnectionError(error);
      const message = error instanceof Error ? error.message : String(error);

      if (phase === 'pairing_required' || phase === 'auth_required') {
        this.paused = true;
        this.desiredConnected = false;
        this.handlers.onPhaseChange(phase, message);
        return;
      }

      this.handlers.onPhaseChange('error', message);
      this.scheduleReconnect();
      throw error;
    }
  }

  private handleEvent(event: GatewayEventFrame, role: GatewayClientRole): void {
    this.handlers.onRawEvent?.(event, role);

    if (event.event === 'chat') {
      const payload = event.payload as GatewayChatEventPayload | undefined;
      if (payload && typeof payload.sessionKey === 'string') {
        this.handlers.onChatEvent(payload);
      }
      return;
    }

    if (event.event === 'agent') {
      const payload = event.payload as GatewayAgentEventPayload | undefined;
      if (payload) {
        this.handlers.onAgentEvent(payload);
      }
      return;
    }

    if (event.event === 'talk.mode') {
      const payload = event.payload as { enabled?: unknown } | undefined;
      if (payload && typeof payload.enabled === 'boolean') {
        this.handlers.onAgentEvent({ text: payload.enabled ? 'Talk enabled from gateway' : 'Talk disabled from gateway' });
      }
    }
  }

  private handleClientClose(): void {
    if (!this.desiredConnected || this.paused) {
      return;
    }
    this.handlers.onPhaseChange('connecting', 'Reconnecting…');
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (!this.desiredConnected || this.paused || !this.lastConfig || this.reconnectTimer) {
      return;
    }

    const delayMs = Math.min(1_000 * 2 ** this.reconnectAttempts, 15_000);
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.lastConfig || !this.desiredConnected || this.paused) {
        return;
      }
      void this.connectNow(this.lastConfig).catch(() => {
        this.scheduleReconnect();
      });
    }, delayMs);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export function buildConnectSummary(hello: GatewayHelloOk | null): string {
  if (!hello) {
    return 'No handshake yet';
  }
  const version = hello.server?.version ?? 'unknown';
  const role = hello.auth?.role ?? 'unknown';
  return `Gateway ${version} (${role})`;
}
