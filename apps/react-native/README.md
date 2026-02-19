# OpenClaw React Native App

Expo-managed mobile app for OpenClaw node/operator workflows.

## Implemented now

- Manual gateway connect (host/port/TLS + token/password)
- First-run onboarding wizard:
  - welcome
  - setup code/manual gateway setup
  - feature toggles
  - connect + enter app
- Setup code decode (JSON or base64 JSON)
- Dual gateway sessions:
  - `role=node` for capability registration
  - `role=operator` for chat/talk RPC
- Connection phases with pairing/auth/error states
- Exponential reconnect (paused on pairing/auth failures)
- Chat:
  - `chat.history`
  - `chat.send`
  - `chat.abort`
  - stream handling for `chat` events
- Voice controls:
  - `talk.mode` sync toggle
  - voice wake capability toggle (registration-level)
- Settings-driven capability registration for node connect payload
- Basic diagnostics (recent gateway events)

## App tabs

- Connect
- Chat
- Voice
- Screen
- Settings

## Run

From `apps/react-native`:

```bash
bun install
bun run start
bun run android
```

Quality checks:

```bash
bun run typecheck
bun run lint
```

From repo root:

```bash
pnpm react-native:start
pnpm react-native:android
pnpm react-native:typecheck
pnpm react-native:lint
```

## Getting setup code / URL

Run on the gateway machine:

```bash
openclaw qr --setup-code-only
openclaw qr --json
```

- `--json` includes both `setupCode` and `gatewayUrl`.
- Android emulator to host-machine gateway: use `10.0.2.2`.
- Real device: use reachable LAN/Tailscale host, not `127.0.0.1`.

## Current limitations

- Discovery + QR scanning UI not wired yet
- Embedded WebView canvas not wired yet (screen tab opens canvas URL externally)
- PTT local audio capture/streaming not wired yet
- Onboarding completion persists; broader app settings persistence is still pending
