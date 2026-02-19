import { buildDeviceAuthPayload } from './device-auth';
import {
  clearDeviceAuthToken,
  loadDeviceAuthToken,
  loadOrCreateDeviceIdentity,
  signDevicePayload,
  storeDeviceAuthToken,
} from './device-identity';
import {
  GATEWAY_PROTOCOL_VERSION,
  type GatewayClientConnectParams,
  type GatewayEventFrame,
  type GatewayHelloOk,
  type GatewayResponseError,
  type GatewayResponseFrame,
  type GatewayServerFrame,
} from './protocol';

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

const CONNECT_TIMEOUT_MS = 15_000;
const CONNECT_CHALLENGE_TIMEOUT_MS = 5_000;

export class GatewayRequestError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(error: GatewayResponseError) {
    super(error.message);
    this.name = 'GatewayRequestError';
    this.code = error.code;
    this.details = error.details;
  }
}

export type GatewayClientCallbacks = {
  onEvent?: (event: GatewayEventFrame) => void;
  onClose?: (code: number, reason: string) => void;
};

function isResponseFrame(frame: GatewayServerFrame): frame is GatewayResponseFrame {
  return frame.type === 'res';
}

function isEventFrame(frame: GatewayServerFrame): frame is GatewayEventFrame {
  return frame.type === 'event';
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(String(value));
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private nextId = 1;
  private connectSent = false;
  private connectNonce: string | null = null;
  private connectRequestPromise: Promise<GatewayHelloOk> | null = null;
  private challengeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private closingByClient = false;

  constructor(
    private readonly url: string,
    private readonly callbacks: GatewayClientCallbacks = {},
  ) {}

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async connect(params: GatewayClientConnectParams): Promise<GatewayHelloOk> {
    if (this.ws) {
      throw new Error('Gateway client already started');
    }

    this.connectSent = false;
    this.connectNonce = null;
    this.connectRequestPromise = null;
    this.closingByClient = false;

    return await new Promise<GatewayHelloOk>((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      let connectSettled = false;

      const cleanup = () => {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
      };

      const rejectOnce = (reason: unknown) => {
        if (connectSettled) {
          return;
        }
        connectSettled = true;
        clearTimeout(connectTimeoutId);
        reject(reason);
      };

      const resolveOnce = (hello: GatewayHelloOk) => {
        if (connectSettled) {
          return;
        }
        connectSettled = true;
        clearTimeout(connectTimeoutId);
        resolve(hello);
      };

      const connectTimeoutId = setTimeout(() => {
        this.closingByClient = true;
        this.ws?.close(4000, 'connect timeout');
        rejectOnce(new Error(`Gateway connect timeout (${CONNECT_TIMEOUT_MS}ms)`));
      }, CONNECT_TIMEOUT_MS);

      ws.onopen = () => {
        this.challengeTimeoutId = setTimeout(() => {
          this.closingByClient = true;
          this.ws?.close(1008, 'connect challenge timeout');
          rejectOnce(new Error(`Gateway connect challenge timeout (${CONNECT_CHALLENGE_TIMEOUT_MS}ms)`));
        }, CONNECT_CHALLENGE_TIMEOUT_MS);
      };

      ws.onmessage = (event) => {
        const data = typeof event.data === 'string' ? event.data : String(event.data ?? '');
        this.handleMessage(data, params, resolveOnce, rejectOnce);
      };

      ws.onerror = () => {
        clearTimeout(connectTimeoutId);
        cleanup();
        rejectOnce(new Error('Gateway WebSocket error'));
      };

      ws.onclose = (event) => {
        clearTimeout(connectTimeoutId);
        const closedByClient = this.closingByClient;
        this.closingByClient = false;
        this.clearChallengeTimeout();
        this.flushPending(new Error(`Gateway closed (${event.code}): ${event.reason}`));
        this.ws = null;
        if (!closedByClient) {
          this.callbacks.onClose?.(event.code, event.reason);
        }

        if (!this.connectSent) {
          cleanup();
          rejectOnce(new Error(`Gateway closed before connect (${event.code})`));
        }
      };
    });
  }

  disconnect(code = 1000, reason = 'client disconnect'): void {
    this.clearChallengeTimeout();
    this.flushPending(new Error('Gateway client disconnected'));
    this.closingByClient = true;
    this.ws?.close(code, reason);
    this.ws = null;
    this.connectSent = false;
    this.connectNonce = null;
    this.connectRequestPromise = null;
  }

  async request<T>(method: string, params?: unknown, timeoutMs = 20_000): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Gateway not connected');
    }

    const id = String(this.nextId++);
    const frame = {
      type: 'req',
      id,
      method,
      params,
    } as const;

    return await new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Gateway request timeout: ${method}`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (value: unknown) => {
          resolve(value as T);
        },
        reject,
        timeoutId,
      });

      try {
        this.ws?.send(JSON.stringify(frame));
      } catch (error) {
        clearTimeout(timeoutId);
        this.pending.delete(id);
        reject(toError(error));
      }
    });
  }

  private async sendConnect(
    params: GatewayClientConnectParams,
    nonce: string,
  ): Promise<GatewayHelloOk> {
    if (this.connectRequestPromise) {
      return await this.connectRequestPromise;
    }

    this.connectSent = true;
    this.connectNonce = nonce;
    this.clearChallengeTimeout();

    const role = params.role;
    const scopes = params.scopes ?? [];
    const explicitGatewayToken = params.auth?.token?.trim() || undefined;
    const explicitDeviceToken = params.auth?.deviceToken?.trim() || undefined;
    const explicitPassword = params.auth?.password?.trim() || undefined;

    const identity = await loadOrCreateDeviceIdentity();
    const storedDeviceAuth = await loadDeviceAuthToken(identity.deviceId, role);
    const resolvedDeviceToken =
      explicitDeviceToken ??
      (!explicitGatewayToken ? (storedDeviceAuth?.token ?? undefined) : undefined);
    const authToken = explicitGatewayToken ?? resolvedDeviceToken;
    const signedAtMs = Date.now();
    const signaturePayload = buildDeviceAuthPayload({
      deviceId: identity.deviceId,
      clientId: params.client.id,
      clientMode: params.client.mode,
      role,
      scopes,
      signedAtMs,
      token: authToken ?? null,
      nonce,
    });
    const signature = await signDevicePayload(signaturePayload, identity);
    const auth =
      authToken || explicitPassword || resolvedDeviceToken
        ? {
            token: authToken,
            deviceToken: resolvedDeviceToken,
            password: explicitPassword,
          }
        : undefined;

    this.connectRequestPromise = this.request<GatewayHelloOk>('connect', {
      minProtocol: params.minProtocol ?? GATEWAY_PROTOCOL_VERSION,
      maxProtocol: params.maxProtocol ?? GATEWAY_PROTOCOL_VERSION,
      client: params.client,
      role,
      scopes,
      caps: params.caps ?? [],
      commands: params.commands ?? [],
      permissions: params.permissions ?? {},
      auth,
      device: {
        id: identity.deviceId,
        publicKey: identity.publicKey,
        signature,
        signedAt: signedAtMs,
        nonce,
      },
    });

    try {
      const hello = await this.connectRequestPromise;
      const issuedDeviceToken = hello.auth?.deviceToken;
      if (issuedDeviceToken) {
        await storeDeviceAuthToken({
          deviceId: identity.deviceId,
          role: hello.auth?.role ?? role,
          token: issuedDeviceToken,
          scopes: hello.auth?.scopes ?? [],
        });
      }
      return hello;
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      if (message.includes('device token mismatch')) {
        await clearDeviceAuthToken(identity.deviceId, role);
      }
      throw error;
    }
  }

  private handleMessage(
    raw: string,
    connectParams: GatewayClientConnectParams,
    resolveConnect: (hello: GatewayHelloOk) => void,
    rejectConnect: (reason: unknown) => void,
  ): void {
    let frame: GatewayServerFrame;
    try {
      frame = JSON.parse(raw) as GatewayServerFrame;
    } catch {
      return;
    }

    if (isEventFrame(frame)) {
      if (frame.event === 'connect.challenge') {
        const payload = frame.payload as { nonce?: unknown } | undefined;
        const nonce = typeof payload?.nonce === 'string' ? payload.nonce.trim() : '';
        if (nonce.length === 0) {
          rejectConnect(new Error('Gateway connect challenge missing nonce'));
          this.closingByClient = true;
          this.ws?.close(1008, 'connect challenge missing nonce');
          return;
        }
        void this.sendConnect(connectParams, nonce).then(resolveConnect).catch(rejectConnect);
        return;
      }
      this.callbacks.onEvent?.(frame);
      return;
    }

    if (!isResponseFrame(frame)) {
      return;
    }

    const pending = this.pending.get(frame.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutId);
    this.pending.delete(frame.id);

    if (frame.ok) {
      pending.resolve(frame.payload);
      return;
    }

    pending.reject(new GatewayRequestError(frame.error ?? { code: 'unknown', message: 'Unknown gateway error' }));
  }

  private flushPending(error: Error): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeoutId);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private clearChallengeTimeout(): void {
    if (this.challengeTimeoutId !== null) {
      clearTimeout(this.challengeTimeoutId);
      this.challengeTimeoutId = null;
    }
  }
}
