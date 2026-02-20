import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { decodeSetupCode } from '../../gateway/setup-code';
import { colors, gradients, radii, shadows, typography } from '../../app/theme';
import { CodeBlock, Input, Label } from '../shared/ui';

type ConnectMethod = 'setup' | 'manual';

const stepMeta = [
  { title: 'Welcome', subtitle: 'What this app controls' },
  { title: 'Gateway', subtitle: 'Pair and connect' },
  { title: 'Features', subtitle: 'Select device capabilities' },
  { title: 'Connect', subtitle: 'Review and enter app' },
] as const;

const minBottomPadding = 8;

function extractRequestId(text: string): string | null {
  const match = text.match(/requestid[:=]\s*([a-z0-9-]+)/i);
  return match?.[1] ?? null;
}

export function OnboardingFlow({ onFinish }: { onFinish: () => void }) {
  const { state, actions } = useAppStore();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, minBottomPadding);
  const clipboardAutofillAttemptedRef = useRef(false);

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

  const applySetupCodeInput = useCallback((setupCode: string) => {
    actions.setGatewayConfig({ setupCode });
    if (setupCode.trim().length === 0) {
      return;
    }
    if (!decodeSetupCode(setupCode)) {
      return;
    }
    actions.applySetupCode();
  }, [actions]);

  const setupReady = useMemo(() => {
    const setupCode = state.gatewayConfig.setupCode.trim();
    return setupCode.length > 0 && decodeSetupCode(setupCode) !== null;
  }, [state.gatewayConfig.setupCode]);
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
  const primaryDisabled = canGoNext ? !canAdvance : !canConnect;
  const primaryLabel = canGoNext ? 'Next' : connecting ? 'Connecting...' : 'Connect & Enter App';

  useEffect(() => {
    if (step !== 1 || method !== 'setup') {
      return;
    }
    if (clipboardAutofillAttemptedRef.current) {
      return;
    }
    if (state.gatewayConfig.setupCode.trim().length > 0) {
      return;
    }

    clipboardAutofillAttemptedRef.current = true;
    void Clipboard.getStringAsync()
      .then((text) => {
        const candidate = text.trim();
        if (candidate.length === 0 || !decodeSetupCode(candidate)) {
          return;
        }
        applySetupCodeInput(candidate);
      })
      .catch(() => {
        // Clipboard read failures should not block onboarding interaction.
      });
  }, [applySetupCodeInput, method, state.gatewayConfig.setupCode, step]);

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
      <LinearGradient colors={gradients.background} style={StyleSheet.absoluteFill} />

      <View style={styles.layout}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: bottomInset + 108 },
          ]}
        >
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>FIRST RUN</Text>
            <Text style={styles.title}>OpenClaw{'\n'}Mobile Setup</Text>
            <Text style={styles.stepCounter}>Step {step + 1} of {stepMeta.length}</Text>
          </View>

          <View style={styles.stepRailWrap}>
            <View style={styles.stepRail}>
              {stepMeta.map((item, index) => {
                const active = index === step;
                const complete = index < step;
                return (
                  <View key={item.title} style={styles.stepItem}>
                    <View style={[styles.stepBar, active ? styles.stepBarActive : undefined, complete ? styles.stepBarComplete : undefined]} />
                    <Text style={active ? styles.stepTitleActive : styles.stepTitle}>{item.title}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {step === 0 ? <WelcomeStep /> : null}
          {step === 1 ? (
            <GatewayStep
              endpointSummary={endpointSummary}
              method={method}
              onMethodChange={setMethod}
              onSetupCodeChange={applySetupCodeInput}
              setupReady={setupReady}
            />
          ) : null}
          {step === 2 ? <FeaturesStep /> : null}
          {step === 3 ? <ConnectStep endpointSummary={endpointSummary} method={method} features={selectedFeatures} /> : null}

          {step === 1 && !gatewayReady ? (
            <Text style={styles.validationText}>
              {method === 'setup' ? 'Paste a valid setup code to continue.' : 'Add a valid host and port to continue.'}
            </Text>
          ) : null}

          {step === 3 ? (
            <View style={styles.statusGroup}>
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
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: bottomInset }]}>
          <View style={styles.navigationRow}>
            <Pressable
              onPress={() => setStep((prev) => Math.max(0, prev - 1))}
              disabled={!canGoBack}
              style={({ pressed }) => [
                styles.backPressable,
                !canGoBack ? styles.backPressableDisabled : undefined,
                pressed && canGoBack ? styles.backPressablePressed : undefined,
              ]}
            >
              <ArrowLeft size={18} color={canGoBack ? colors.textSecondary : colors.textTertiary} />
            </Pressable>

            <Pressable
              onPress={() => {
                if (canGoNext) {
                  setStep((prev) => Math.min(stepMeta.length - 1, prev + 1));
                  return;
                }
                void connectAndFinish();
              }}
              disabled={primaryDisabled}
              style={({ pressed }) => [
                styles.primaryNavButton,
                primaryDisabled ? styles.primaryNavButtonDisabled : undefined,
                pressed && !primaryDisabled ? styles.primaryNavButtonPressed : undefined,
              ]}
            >
              <Text style={styles.primaryNavLabel}>{primaryLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function StepShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.stepShell}>
      <Text style={styles.stepShellTitle}>{title}</Text>
      {children}
    </View>
  );
}

function WelcomeStep() {
  return (
    <StepShell title="What You Get">
      <Bullet text="Control the gateway and operator chat from one mobile surface." />
      <Bullet text="Enable only the capabilities you need right now and adjust later." />
      <Bullet text="See pairing requirements early, with direct CLI recovery steps." />
    </StepShell>
  );
}

function GatewayStep({
  endpointSummary,
  method,
  onMethodChange,
  onSetupCodeChange,
  setupReady,
}: {
  endpointSummary: string;
  method: ConnectMethod;
  onMethodChange: (method: ConnectMethod) => void;
  onSetupCodeChange: (setupCode: string) => void;
  setupReady: boolean;
}) {
  const { state, actions } = useAppStore();
  const [showJsonCommand, setShowJsonCommand] = useState(false);

  return (
    <StepShell title="Gateway Connection">
      <View style={styles.guideBlock}>
        <Text style={styles.guideTitle}>Get setup code + gateway URL</Text>
        <Text style={styles.guideText}>Run these on the gateway host:</Text>
        <CodeBlock value="openclaw qr --setup-code-only" />
        <Pressable onPress={() => setShowJsonCommand((prev) => !prev)} style={styles.revealCommand}>
          <Text style={styles.revealCommandText}>{showJsonCommand ? 'Hide JSON command' : 'Show JSON command'}</Text>
        </Pressable>
        {showJsonCommand ? (
          <>
            <CodeBlock value="openclaw qr --json" />
            <Text style={styles.guideText}>`--json` prints `setupCode` and `gatewayUrl`.</Text>
          </>
        ) : null}
      </View>

      <View style={styles.methodRow}>
        {(['setup', 'manual'] as const).map((m) => {
          const active = method === m;
          return (
            <Pressable
              key={m}
              onPress={() => onMethodChange(m)}
              style={({ pressed }) => [
                styles.methodChip,
                active ? styles.methodChipActive : styles.methodChipInactive,
                pressed ? styles.methodChipPressed : undefined,
              ]}
            >
              <Text style={active ? styles.methodChipTextActive : styles.methodChipText}>
                {m === 'setup' ? 'Setup Code' : 'Manual'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {method === 'setup' ? (
        <>
          <Label text="Setup Code" />
          <Input
            placeholder="Paste setup code"
            value={state.gatewayConfig.setupCode}
            onChangeText={onSetupCodeChange}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={styles.setupCodeInput}
          />
          {setupReady ? (
            <View style={styles.endpointPreview}>
              <Text style={styles.endpointPreviewLabel}>Resolved endpoint</Text>
              <Text style={styles.endpointPreviewValue}>{endpointSummary}</Text>
            </View>
          ) : null}
        </>
      ) : null}

      {method === 'manual' ? (
        <>
          <View style={styles.quickFillRow}>
            <Pressable
              style={styles.quickFillChip}
              onPress={() => actions.setGatewayConfig({ host: '10.0.2.2', port: '18789', tls: false })}
            >
              <Text style={styles.quickFillText}>Android Emulator</Text>
            </Pressable>
            <Pressable
              style={styles.quickFillChip}
              onPress={() => actions.setGatewayConfig({ host: '127.0.0.1', port: '18789', tls: false })}
            >
              <Text style={styles.quickFillText}>Localhost</Text>
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
            <Switch
              value={state.gatewayConfig.tls}
              onValueChange={(tls) => actions.setGatewayConfig({ tls })}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
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
    </StepShell>
  );
}

function FeaturesStep() {
  const { state, actions } = useAppStore();

  return (
    <StepShell title="Device Features">
      <FeatureToggle
        label="Camera"
        detail="Allow camera-based capability registration."
        value={state.cameraEnabled}
        onChange={(enabled) => void actions.setCameraEnabled(enabled)}
      />

      <View style={styles.inlineDivider} />

      <FeatureToggle
        label="Location"
        detail="Enable location-related agent tools."
        value={state.locationEnabled}
        onChange={(enabled) => void actions.setLocationEnabled(enabled)}
      />

      <View style={styles.inlineDivider} />

      <FeatureToggle
        label="Talk Mode"
        detail="Keep gateway voice session interactive."
        value={state.talkEnabled}
        onChange={(enabled) => void actions.setTalkEnabled(enabled)}
      />

      <View style={styles.inlineDivider} />

      <FeatureToggle
        label="Voice Wake"
        detail="Allow wake-word flow on supported setups."
        value={state.voiceWakeEnabled}
        onChange={(enabled) => void actions.setVoiceWakeEnabled(enabled)}
      />

      <Text style={styles.bodyText}>All settings can be changed later in the Settings tab.</Text>
    </StepShell>
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
    <StepShell title="Review">
      <SummaryField label="Method" value={method === 'setup' ? 'Setup Code' : 'Manual'} />
      <SummaryField label="Gateway" value={endpointSummary} />
      <SummaryField label="Enabled Features" value={features} />

      <Text style={styles.bodyText}>Current status: {state.statusText}</Text>
      {state.phase === 'pairing_required' ? (
        <View style={styles.guideBlock}>
          <Text style={styles.guideTitle}>Pairing Required</Text>
          <Text style={styles.guideText}>Run these on the gateway host:</Text>
          <CodeBlock value="openclaw devices list" />
          <CodeBlock value={pairingRequestId ? `openclaw devices approve ${pairingRequestId}` : 'openclaw devices approve'} />
          <Text style={styles.guideText}>Then tap Connect & Enter App again.</Text>
        </View>
      ) : (
        <Text style={styles.bodyText}>If pairing is required, approve from the gateway host CLI after connect.</Text>
      )}
    </StepShell>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <LinearGradient colors={gradients.accent} style={styles.bulletDot} />
      <Text style={styles.bodyText}>{text}</Text>
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
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.accent }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  layout: {
    flex: 1,
  },
  content: {
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  hero: {
    gap: 8,
    paddingBottom: 2,
    paddingTop: 12,
  },
  eyebrow: {
    ...typography.caption1,
    color: colors.accent,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    ...typography.display,
    color: colors.text,
    lineHeight: 38,
  },
  stepCounter: {
    ...typography.caption1,
    color: colors.accent,
    marginTop: 6,
  },
  stepRailWrap: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  stepRail: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  stepBar: {
    backgroundColor: colors.border,
    borderRadius: 3,
    height: 5,
    width: '100%',
  },
  stepBarActive: {
    backgroundColor: colors.accent,
  },
  stepBarComplete: {
    backgroundColor: colors.success,
  },
  stepTitle: {
    ...typography.caption2,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  stepTitleActive: {
    ...typography.caption2,
    color: colors.accent,
    fontWeight: '700',
  },
  stepShell: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
    paddingVertical: 14,
  },
  stepShellTitle: {
    ...typography.title1,
    color: colors.text,
  },
  guideBlock: {
    borderLeftColor: colors.accent,
    borderLeftWidth: 2,
    gap: 8,
    paddingLeft: 12,
  },
  guideTitle: {
    ...typography.headline,
    color: colors.text,
  },
  guideText: {
    ...typography.callout,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  bodyText: {
    ...typography.callout,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  bulletRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  bulletDot: {
    borderRadius: radii.pill,
    height: 8,
    marginTop: 6,
    width: 8,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  methodChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  methodChipActive: {
    backgroundColor: colors.accent,
    borderColor: '#184DAF',
    ...shadows.sm,
  },
  methodChipInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
  },
  methodChipPressed: {
    opacity: 0.9,
  },
  methodChipText: {
    ...typography.caption1,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  methodChipTextActive: {
    ...typography.caption1,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  revealCommand: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  revealCommandText: {
    ...typography.caption1,
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  setupCodeInput: {
    ...typography.mono,
    minHeight: 92,
    paddingTop: 14,
  },
  endpointPreview: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
    paddingVertical: 8,
  },
  endpointPreviewLabel: {
    ...typography.caption2,
    color: colors.textSecondary,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  endpointPreviewValue: {
    ...typography.mono,
    color: colors.text,
  },
  quickFillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickFillChip: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickFillText: {
    ...typography.caption1,
    color: colors.accent,
    fontWeight: '600',
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
    ...typography.headline,
    color: colors.text,
  },
  toggleHint: {
    ...typography.callout,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  inlineDivider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
  },
  summaryRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
    paddingVertical: 8,
  },
  summaryLabel: {
    ...typography.caption2,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  summaryValue: {
    ...typography.headline,
    color: colors.text,
  },
  validationText: {
    ...typography.caption1,
    color: colors.warning,
  },
  statusGroup: {
    gap: 8,
  },
  connectingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  connectingText: {
    ...typography.caption1,
    color: colors.textSecondary,
  },
  errorText: {
    ...typography.caption1,
    color: colors.danger,
  },
  skipText: {
    ...typography.callout,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  bottomBar: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  navigationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  backPressable: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: 14,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  backPressableDisabled: {
    borderColor: colors.border,
    opacity: 0.65,
  },
  backPressablePressed: {
    opacity: 0.86,
  },
  primaryNavButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderColor: '#184DAF',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
    ...shadows.sm,
  },
  primaryNavButtonDisabled: {
    opacity: 0.45,
  },
  primaryNavButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  primaryNavLabel: {
    ...typography.headline,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
