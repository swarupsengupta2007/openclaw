export type GatewaySetupPayload = {
  url?: string;
  host?: string;
  port?: number;
  tls?: boolean;
  token?: string;
  password?: string;
};

function decodeJson(raw: string): GatewaySetupPayload | null {
  try {
    const parsed = JSON.parse(raw) as GatewaySetupPayload;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function decodeBase64(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = normalized.length % 4;
  const padded = padLength === 0 ? normalized : normalized + '='.repeat(4 - padLength);

  try {
    return atob(padded);
  } catch {
    return null;
  }
}

export function decodeSetupCode(raw: string): GatewaySetupPayload | null {
  const direct = decodeJson(raw);
  if (direct) {
    return direct;
  }

  const decoded = decodeBase64(raw);
  if (!decoded) {
    return null;
  }

  return decodeJson(decoded);
}

export function buildGatewayUrl(host: string, port: number, tls: boolean): string {
  const protocol = tls ? 'wss' : 'ws';
  return `${protocol}://${host}:${port}`;
}
