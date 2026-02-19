export type GatewayRequestFrame = {
  type: 'req';
  id: string;
  method: string;
  params?: unknown;
};

export type GatewayResponseError = {
  code: string;
  message: string;
  details?: unknown;
};

export type GatewayResponseFrame = {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: GatewayResponseError;
};

export type GatewayEventFrame = {
  type: 'event';
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: { presence: number; health: number };
};

export type GatewayServerFrame = GatewayResponseFrame | GatewayEventFrame;

export type GatewayClientRole = 'node' | 'operator';

export type GatewayClientConnectParams = {
  role: GatewayClientRole;
  scopes?: string[];
  caps?: string[];
  commands?: string[];
  permissions?: Record<string, boolean>;
  device?: {
    id: string;
    publicKey: string;
    signature: string;
    signedAt: number;
    nonce: string;
  };
  auth?: {
    token?: string;
    password?: string;
    deviceToken?: string;
  };
  client: {
    id: string;
    version: string;
    platform: string;
    mode: string;
    instanceId?: string;
  };
  minProtocol?: number;
  maxProtocol?: number;
};

export type GatewayHelloOk = {
  type: 'hello-ok';
  protocol: number;
  server?: {
    version?: string;
    connId?: string;
  };
  features?: { methods?: string[]; events?: string[] };
  auth?: {
    role?: string;
    scopes?: string[];
    deviceToken?: string;
  };
};

export type GatewayChatEventPayload = {
  runId: string;
  sessionKey: string;
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: unknown;
  errorMessage?: string;
};

export type GatewayAgentEventPayload = {
  sessionKey?: string;
  text?: string;
};

export type ChatSendResponse = {
  runId: string;
};

export type ChatHistoryResponse = {
  messages?: unknown[];
  thinkingLevel?: string;
};

export type SessionsListResponse = {
  sessions?: {
    key: string;
    title?: string;
  }[];
};

export type TalkModeParams = {
  enabled: boolean;
  phase?: string;
};

export type NodeInvokeParams = {
  nodeId: string;
  command: string;
  params?: unknown;
};

export const GATEWAY_PROTOCOL_VERSION = 3;
