import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../app/app-store';
import { colors, gradients, radii } from '../../app/theme';
import { ActionButton, Input, Label, Section, SectionTitle } from '../shared/ui';

type ConnectMethod = 'setup' | 'manual';

const stepMeta = [
  { title: 'Welcome', subtitle: 'What this app controls' },
  { title: 'Gateway', subtitle: 'Pair and connect' },
  { title: 'Features', subtitle: 'Select device capabilities' },
  { title: 'Connect', subtitle: 'Review and enter app' },
] as const;

const minBottomPadding = 28;

function extractRequestId(text: string): string | null {
  const match = text.match(/requestid[:=]\s*([a-z0-9-]+)/i);
  return match?.[1] ?? null;
}

export function OnboardingFlow({ onFinish }: { onFinish: () => void }) {
  const { state, actions } = useAppStore();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<ConnectMethod>('setup');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!connecting) {
      return;
    }

    if (state.phase === 'connected') {
      setConnecting(false);
      onFinish();
      return;
    }

    if (state.phase === 'error' || state.phase === 'auth_required' || state.phase === 'pairing_required') {
      setConnecting(false);
    }
  }, [connecting, onFinish, state.phase]);

  const setupReady = state.gatewayConfig.setupCode.trim().length > 0;
  const manualReady = useMemo(() => {
    const host = state.gatewayConfig.host.trim();
    const port = Number(state.gatewayConfig.port);
    return host.length > 0 && Number.isInteger(port) && port > 0 && port <= 65535;
  }, [state.gatewayConfig.host, state.gatewayConfig.port]);

  const gatewayReady = method === 'setup' ? setupReady : manualReady;
  const canGoBack = step > 0;
  const canGoNext = step < stepMeta.length - 1;
  const canAdvance = step === 1 ? gatewayReady : true;
  const canConnect = gatewayReady && !connecting;

  const endpointSummary = useMemo(() => {
    const scheme = state.gatewayConfig.tls ? 'wss' : 'ws';
    return `${scheme}://${state.gatewayConfig.host}:${state.gatewayConfig.port}`;
  }, [state.gatewayConfig.host, state.gatewayConfig.port, state.gatewayConfig.tls]);

  const selectedFeatures = useMemo(() => {
    const list: string[] = [];
    if (state.cameraEnabled) {
      list.push('Camera');
    }
    if (state.locationEnabled) {
      list.push('Location');
    }
    if (state.talkEnabled) {
      list.push('Talk');
    }
    if (state.voiceWakeEnabled) {
      list.push('Voice Wake');
    }
    return list.length > 0 ? list.join(', ') : 'No capabilities enabled yet';
  }, [state.cameraEnabled, state.locationEnabled, state.talkEnabled, state.voiceWakeEnabled]);

  async function connectAndFinish() {
    if (!canConnect) {
      return;
    }

    if (method === 'setup') {
      actions.applySetupCode();
    }

    setConnecting(true);
    await actions.connect();
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <LinearGradient colors={gradients.appBackground} style={StyleSheet.absoluteFill} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, minBottomPadding) + 20 },
        ]}
      >
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>FIRST RUN</Text>
          <Text style={styles.title}>OpenClaw Mobile Setup</Text>
          <Text style={styles.subtitle}>Fast onboarding. Deterministic connection. No hidden steps.</Text>
          <View style={styles.heroMetaRow}>
            <Text style={styles.heroMetaText}>Approx. 2 minutes</Text>
            <Text style={styles.heroMetaText}>Step {step + 1} of {stepMeta.length}</Text>
          </View>
        </View>

        <Section>
          <View style={styles.stepRail}>
            {stepMeta.map((item, index) => {
              const active = index === step;
              const complete = index < step;

              return (
                <View key={item.title} style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepDot,
                      active ? styles.stepDotActive : undefined,
                      complete ? styles.stepDotComplete : undefined,
                    ]}
                  />
                  <Text style={active ? styles.stepTitleActive : styles.stepTitle}>{item.title}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.stepSubtitle}>{stepMeta[step]?.subtitle ?? ''}</Text>
        </Section>

        {step === 0 ? <WelcomeStep /> : null}
        {step === 1 ? <GatewayStep method={method} onMethodChange={setMethod} /> : null}
        {step === 2 ? <FeaturesStep /> : null}
        {step === 3 ? <ConnectStep endpointSummary={endpointSummary} method={method} features={selectedFeatures} /> : null}

        <Section>
          <View style={styles.navigationRow}>
            <Pressable
              onPress={() => setStep((prev) => Math.max(0, prev - 1))}
              disabled={!canGoBack}
              style={styles.backPressable}
            >
              <Text style={canGoBack ? styles.backText : styles.backTextDisabled}>Back</Text>
            </Pressable>

            {canGoNext ? (
              <ActionButton
                label="Next"
                onPress={() => setStep((prev) => Math.min(stepMeta.length - 1, prev + 1))}
                disabled={!canAdvance}
              />
            ) : (
              <ActionButton
                label={connecting ? 'Connecting...' : 'Connect & Enter App'}
                onPress={() => void connectAndFinish()}
                disabled={!canConnect}
              />
            )}
          </View>

          {step === 1 && !gatewayReady ? (
            <Text style={styles.validationText}>
              {method === 'setup' ? 'Paste a setup code to continue.' : 'Add a valid host and port to continue.'}
            </Text>
          ) : null}

          {step === 3 ? (
            <>
              {connecting ? (
                <View style={styles.connectingRow}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={styles.connectingText}>Waiting for gateway response...</Text>
                </View>
              ) : null}

              {state.phase === 'error' ? <Text style={styles.errorText}>{state.statusText}</Text> : null}

              <Pressable onPress={onFinish}>
                <Text style={styles.skipText}>Skip for now</Text>
              </Pressable>
            </>
          ) : null}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function WelcomeStep() {
  return (
    <Section>
      <SectionTitle title="What You Get" />
      <Bullet text="Node controls and operator chat from one app shell." />
      <Bullet text="Capability toggles for camera, talk mode, location, and voice wake." />
      <Bullet text="Realtime gateway status, pairing feedback, and session-aware chat." />
    </Section>
  );
}

function GatewayStep({
  method,
  onMethodChange,
}: {
  method: ConnectMethod;
  onMethodChange: (method: ConnectMethod) => void;
}) {
  const { state, actions } = useAppStore();

  return (
    <Section>
      <SectionTitle title="Gateway Connection" />
      <View style={styles.guideCard}>
        <Text style={styles.guideTitle}>Get setup code + gateway URL</Text>
        <Text style={styles.guideText}>Run these on the gateway host:</Text>
        <CodeLine value="openclaw qr --setup-code-only" />
        <CodeLine value="openclaw qr --json" />
        <Text style={styles.guideText}>`--json` prints `setupCode` and `gatewayUrl`.</Text>
        <Text style={styles.guideText}>
          Auto URL discovery is not wired yet. Android emulator uses `10.0.2.2`; real devices need LAN/Tailscale host.
        </Text>
      </View>

      <View style={styles.methodRow}>
        <Pressable
          onPress={() => onMethodChange('setup')}
          style={[styles.methodChip, method === 'setup' ? styles.methodChipActive : undefined]}
        >
          <Text style={method === 'setup' ? styles.methodChipTextActive : styles.methodChipText}>Setup Code</Text>
        </Pressable>

        <Pressable
          onPress={() => onMethodChange('manual')}
          style={[styles.methodChip, method === 'manual' ? styles.methodChipActive : undefined]}
        >
          <Text style={method === 'manual' ? styles.methodChipTextActive : styles.methodChipText}>Manual</Text>
        </Pressable>
      </View>

      {method === 'setup' ? (
        <>
          <Label text="Setup Code" />
          <Input
            placeholder="Paste setup code"
            value={state.gatewayConfig.setupCode}
            onChangeText={(setupCode) => actions.setGatewayConfig({ setupCode })}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <ActionButton label="Apply Setup Code" onPress={actions.applySetupCode} />
        </>
      ) : null}

      {method === 'manual' ? (
        <>
          <View style={styles.quickFillRow}>
            <Pressable
              style={styles.quickFillChip}
              onPress={() => actions.setGatewayConfig({ host: '10.0.2.2', port: '18789', tls: false })}
            >
              <Text style={styles.quickFillText}>Use Android Emulator Host</Text>
            </Pressable>
            <Pressable
              style={styles.quickFillChip}
              onPress={() => actions.setGatewayConfig({ host: '127.0.0.1', port: '18789', tls: false })}
            >
              <Text style={styles.quickFillText}>Use Localhost</Text>
            </Pressable>
          </View>

          <Label text="Host" />
          <Input
            placeholder="127.0.0.1"
            value={state.gatewayConfig.host}
            onChangeText={(host) => actions.setGatewayConfig({ host })}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Label text="Port" />
          <Input
            placeholder="18789"
            value={state.gatewayConfig.port}
            onChangeText={(port) => actions.setGatewayConfig({ port })}
            keyboardType="number-pad"
          />

          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleLabel}>Use TLS</Text>
              <Text style={styles.toggleHint}>Switch to secure websocket (`wss`).</Text>
            </View>
            <Switch value={state.gatewayConfig.tls} onValueChange={(tls) => actions.setGatewayConfig({ tls })} />
          </View>

          <Label text="Token (optional)" />
          <Input
            placeholder="token"
            value={state.gatewayConfig.token}
            onChangeText={(token) => actions.setGatewayConfig({ token })}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Label text="Password (optional)" />
          <Input
            placeholder="password"
            value={state.gatewayConfig.password}
            onChangeText={(password) => actions.setGatewayConfig({ password })}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      ) : null}
    </Section>
  );
}

function FeaturesStep() {
  const { state, actions } = useAppStore();

  return (
    <Section>
      <SectionTitle title="Device Features" />

      <FeatureToggle
        label="Camera"
        detail="Allow camera-based capability registration."
        value={state.cameraEnabled}
        onChange={(enabled) => void actions.setCameraEnabled(enabled)}
      />

      <FeatureToggle
        label="Location"
        detail="Enable location-related agent tools."
        value={state.locationEnabled}
        onChange={(enabled) => void actions.setLocationEnabled(enabled)}
      />

      <FeatureToggle
        label="Talk Mode"
        detail="Keep gateway voice session interactive."
        value={state.talkEnabled}
        onChange={(enabled) => void actions.setTalkEnabled(enabled)}
      />

      <FeatureToggle
        label="Voice Wake"
        detail="Allow wake-word flow on supported setups."
        value={state.voiceWakeEnabled}
        onChange={(enabled) => void actions.setVoiceWakeEnabled(enabled)}
      />

      <Text style={styles.bodyText}>All settings can be changed later in the Settings tab.</Text>
    </Section>
  );
}

function ConnectStep({
  endpointSummary,
  method,
  features,
}: {
  endpointSummary: string;
  method: ConnectMethod;
  features: string;
}) {
  const { state } = useAppStore();
  const pairingRequestId = state.phase === 'pairing_required' ? extractRequestId(state.statusText) : null;

  return (
    <Section>
      <SectionTitle title="Review" />

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Method</Text>
        <Text style={styles.summaryValue}>{method === 'setup' ? 'Setup Code' : 'Manual'}</Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Gateway</Text>
        <Text style={styles.summaryValue}>{endpointSummary}</Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Enabled Features</Text>
        <Text style={styles.summaryValue}>{features}</Text>
      </View>

      <Text style={styles.bodyText}>Current status: {state.statusText}</Text>
      {state.phase === 'pairing_required' ? (
        <View style={styles.guideCard}>
          <Text style={styles.guideTitle}>Pairing Required</Text>
          <Text style={styles.guideText}>Run these on the gateway host:</Text>
          <CodeLine value="openclaw devices list" />
          <CodeLine value={pairingRequestId ? `openclaw devices approve ${pairingRequestId}` : 'openclaw devices approve'} />
          <Text style={styles.guideText}>Then tap Connect & Enter App again.</Text>
        </View>
      ) : (
        <Text style={styles.bodyText}>If pairing is required, approve from the gateway host CLI after connect.</Text>
      )}
    </Section>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bodyText}>{text}</Text>
    </View>
  );
}

function CodeLine({ value }: { value: string }) {
  return (
    <View style={styles.codeLine}>
      <Text style={styles.codeLineText}>{value}</Text>
    </View>
  );
}

function FeatureToggle({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleHint}>{detail}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  heroCard: {
    backgroundColor: 'rgba(15,24,40,0.8)',
    borderColor: 'rgba(89,122,176,0.45)',
    borderRadius: radii.card,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  title: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  heroMetaText: {
    color: colors.info,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  stepRail: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  stepDot: {
    backgroundColor: 'rgba(159,178,215,0.22)',
    borderRadius: radii.pill,
    height: 6,
    width: '100%',
  },
  stepDotActive: {
    backgroundColor: colors.info,
  },
  stepDotComplete: {
    backgroundColor: colors.accent,
  },
  stepTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  stepTitleActive: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  stepSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  bodyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  bulletRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  bulletDot: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    height: 7,
    marginTop: 7,
    width: 7,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  methodChip: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  methodChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  methodChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  methodChipTextActive: {
    color: '#051B13',
    fontSize: 12,
    fontWeight: '700',
  },
  guideCard: {
    backgroundColor: 'rgba(17,32,46,0.7)',
    borderColor: 'rgba(67,102,146,0.55)',
    borderRadius: radii.button,
    borderWidth: 1,
    gap: 6,
    padding: 10,
  },
  guideTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  guideText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  codeLine: {
    backgroundColor: 'rgba(9,15,25,0.92)',
    borderColor: 'rgba(42,61,94,0.9)',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  codeLineText: {
    color: '#CAE0FF',
    fontFamily: 'Courier',
    fontSize: 12,
  },
  quickFillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickFillChip: {
    backgroundColor: 'rgba(20,41,57,0.84)',
    borderColor: 'rgba(58,96,132,0.75)',
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickFillText: {
    color: colors.info,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
  },
  toggleCopy: {
    flex: 1,
    paddingRight: 12,
  },
  toggleLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  toggleHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: 'rgba(16,24,38,0.82)',
    borderColor: 'rgba(42,61,94,0.72)',
    borderRadius: radii.button,
    borderWidth: 1,
    gap: 4,
    padding: 10,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  navigationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backPressable: {
    minWidth: 56,
  },
  backText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  backTextDisabled: {
    color: 'rgba(159,178,215,0.42)',
    fontSize: 14,
    fontWeight: '600',
  },
  validationText: {
    color: colors.warning,
    fontSize: 13,
    marginTop: 8,
  },
  connectingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  connectingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginTop: 8,
  },
  skipText: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
