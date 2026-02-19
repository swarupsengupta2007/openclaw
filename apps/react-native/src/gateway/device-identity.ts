import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ed from '@noble/ed25519';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { base64url } from '@scure/base';
import * as Crypto from 'expo-crypto';

const DEVICE_IDENTITY_KEY = '@openclaw/gateway/device-identity/v1';
const DEVICE_AUTH_PREFIX = '@openclaw/gateway/device-auth/v1/';

let ed25519Configured = false;

function ensureEd25519Config(): void {
  if (ed25519Configured) {
    return;
  }
  ed.hashes.sha512Async = async (message: Uint8Array): Promise<Uint8Array> => sha512(message);
  ed25519Configured = true;
}

function normalizeRole(role: string): string {
  const normalized = role.trim();
  return normalized.length > 0 ? normalized : 'operator';
}

function normalizeScopes(scopes: string[]): string[] {
  const out = new Set<string>();
  for (const scope of scopes) {
    const trimmed = scope.trim();
    if (trimmed.length > 0) {
      out.add(trimmed);
    }
  }
  return [...out].sort();
}

function encodeBase64Url(bytes: Uint8Array): string {
  return base64url.encode(bytes);
}

function decodeBase64Url(value: string): Uint8Array {
  return base64url.decode(value);
}

function deriveDeviceId(publicKey: Uint8Array): string {
  return bytesToHex(sha256(publicKey));
}

function authStorageKey(deviceId: string, role: string): string {
  return `${DEVICE_AUTH_PREFIX}${deviceId}/${normalizeRole(role)}`;
}

export type DeviceIdentity = {
  version: 1;
  deviceId: string;
  publicKey: string;
  privateKey: string;
  createdAtMs: number;
};

export type DeviceAuthEntry = {
  token: string;
  role: string;
  scopes: string[];
  updatedAtMs: number;
};

function parseStoredIdentity(raw: string): DeviceIdentity | null {
  try {
    const parsed = JSON.parse(raw) as Partial<DeviceIdentity>;
    if (parsed.version !== 1) {
      return null;
    }
    if (typeof parsed.publicKey !== 'string' || typeof parsed.privateKey !== 'string') {
      return null;
    }

    const publicKey = decodeBase64Url(parsed.publicKey);
    const privateKey = decodeBase64Url(parsed.privateKey);
    if (publicKey.length !== 32 || privateKey.length !== 32) {
      return null;
    }

    const createdAtMs = Number.isFinite(parsed.createdAtMs) ? Number(parsed.createdAtMs) : Date.now();
    return {
      version: 1,
      deviceId: deriveDeviceId(publicKey),
      publicKey: encodeBase64Url(publicKey),
      privateKey: encodeBase64Url(privateKey),
      createdAtMs,
    };
  } catch {
    return null;
  }
}

async function createIdentity(): Promise<DeviceIdentity> {
  ensureEd25519Config();
  const secretKey = Crypto.getRandomBytes(32);
  const publicKey = await ed.getPublicKeyAsync(secretKey);
  const identity: DeviceIdentity = {
    version: 1,
    deviceId: deriveDeviceId(publicKey),
    publicKey: encodeBase64Url(publicKey),
    privateKey: encodeBase64Url(secretKey),
    createdAtMs: Date.now(),
  };
  await AsyncStorage.setItem(DEVICE_IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export async function loadOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  const raw = await AsyncStorage.getItem(DEVICE_IDENTITY_KEY);
  if (!raw) {
    return await createIdentity();
  }

  const parsed = parseStoredIdentity(raw);
  if (!parsed) {
    return await createIdentity();
  }

  if (parsed.deviceId !== (JSON.parse(raw) as { deviceId?: string }).deviceId) {
    await AsyncStorage.setItem(DEVICE_IDENTITY_KEY, JSON.stringify(parsed));
  }
  return parsed;
}

export async function signDevicePayload(payload: string, identity: DeviceIdentity): Promise<string> {
  ensureEd25519Config();
  const secretKey = decodeBase64Url(identity.privateKey);
  const signature = await ed.signAsync(new TextEncoder().encode(payload), secretKey);
  return encodeBase64Url(signature);
}

export async function loadDeviceAuthToken(
  deviceId: string,
  role: string,
): Promise<DeviceAuthEntry | null> {
  const raw = await AsyncStorage.getItem(authStorageKey(deviceId, role));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<DeviceAuthEntry>;
    if (typeof parsed.token !== 'string' || parsed.token.trim().length === 0) {
      return null;
    }
    return {
      token: parsed.token,
      role: normalizeRole(parsed.role ?? role),
      scopes: Array.isArray(parsed.scopes) ? normalizeScopes(parsed.scopes) : [],
      updatedAtMs: Number.isFinite(parsed.updatedAtMs) ? Number(parsed.updatedAtMs) : Date.now(),
    };
  } catch {
    return null;
  }
}

export async function storeDeviceAuthToken(params: {
  deviceId: string;
  role: string;
  token: string;
  scopes?: string[];
}): Promise<void> {
  const normalizedRole = normalizeRole(params.role);
  const entry: DeviceAuthEntry = {
    token: params.token,
    role: normalizedRole,
    scopes: normalizeScopes(params.scopes ?? []),
    updatedAtMs: Date.now(),
  };
  await AsyncStorage.setItem(authStorageKey(params.deviceId, normalizedRole), JSON.stringify(entry));
}

export async function clearDeviceAuthToken(deviceId: string, role: string): Promise<void> {
  await AsyncStorage.removeItem(authStorageKey(deviceId, role));
}
