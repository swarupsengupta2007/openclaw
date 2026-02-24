import { LinearGradient } from 'expo-linear-gradient';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAppStore } from '../../app/app-store';
import { decodeSetupCode } from '../../gateway/setup-code';
import { colors, gradients, radii, shadows, typography } from '../../app/theme';
import { CodeBlock, Input, Label } from '../shared/ui';

function extractRequestId(text: string): string | null {
  const match = text.match(/requestid[:=]\s*([a-z0-9-]+)/i);
  return match?.[1] ?? null;
}

type ConnectButtonVisualState = 'connect' | 'connecting' | 'success' | 'disconnect';

const minimumConnectingVisualMs = 520;

export function ConnectScreen({ onResetOnboarding }: { onResetOnboarding: () => Promise<void> }) {
  const { state, actions } = useAppStore();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [buttonVisualState, setButtonVisualState] = useState<ConnectButtonVisualState>(
    state.phase === 'connected' ? 'disconnect' : state.phase === 'connecting' ? 'connecting' : 'connect',
  );
  const previousPhaseRef = useRef(state.phase);
  const successCoreOpacity = useRef(new Animated.Value(0)).current;
  const successCoreScale = useRef(new Animated.Value(0.75)).current;
  const successRingOpacity = useRef(new Animated.Value(0)).current;
  const successRingScale = useRef(new Animated.Value(0.68)).current;
  const successAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const successStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectPressTimeRef = useRef<number | null>(null);
  const phaseRef = useRef(state.phase);

  const pairingRequestId = state.phase === 'pairing_required' ? extractRequestId(state.statusText) : null;
  const showFlourish = buttonVisualState === 'success';
  const actionLabel =
    buttonVisualState === 'connecting'
      ? 'Connecting…'
      : buttonVisualState === 'success'
        ? 'Connected'
        : buttonVisualState === 'disconnect'
          ? 'Disconnect Gateway'
          : 'Connect Gateway';
  const primaryDisabled = buttonVisualState === 'connecting' || buttonVisualState === 'success';

  useEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

  const runSuccessFlourish = useCallback(() => {
    successAnimationRef.current?.stop();
    successAnimationRef.current = null;

    successCoreOpacity.setValue(0);
    successCoreScale.setValue(0.75);
    successRingOpacity.setValue(0);
    successRingScale.setValue(0.68);
    setButtonVisualState('success');

    const flourish = Animated.sequence([
      Animated.delay(90),
      Animated.parallel([
        Animated.timing(successCoreOpacity, {
          toValue: 1,
          duration: 130,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(successCoreScale, {
          toValue: 1,
          speed: 18,
          bounciness: 9,
          useNativeDriver: true,
        }),
        Animated.timing(successRingOpacity, {
          toValue: 0.55,
          duration: 150,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(successRingScale, {
          toValue: 1.26,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(340),
      Animated.parallel([
        Animated.timing(successCoreOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(successRingOpacity, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(successRingScale, {
          toValue: 1.36,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);
    successAnimationRef.current = flourish;
    flourish.start(({ finished }) => {
      successAnimationRef.current = null;
      connectPressTimeRef.current = null;
      if (finished && phaseRef.current === 'connected') {
        setButtonVisualState('disconnect');
        return;
      }
      setButtonVisualState('connect');
    });
  }, [successCoreOpacity, successCoreScale, successRingOpacity, successRingScale]);

  useEffect(() => {
    return () => {
      if (successStartTimerRef.current) {
        clearTimeout(successStartTimerRef.current);
        successStartTimerRef.current = null;
      }
      successAnimationRef.current?.stop();
      successAnimationRef.current = null;
    };
  }, []);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    previousPhaseRef.current = state.phase;
    if (state.phase === 'connecting') {
      setButtonVisualState('connecting');
      return;
    }

    if (state.phase === 'connected') {
      if (previousPhase !== 'connecting' || connectPressTimeRef.current === null) {
        setButtonVisualState('disconnect');
        return;
      }

      if (successStartTimerRef.current) {
        clearTimeout(successStartTimerRef.current);
        successStartTimerRef.current = null;
      }

      const elapsed = Date.now() - connectPressTimeRef.current;
      const delay = Math.max(0, minimumConnectingVisualMs - elapsed);
      setButtonVisualState('connecting');
      successStartTimerRef.current = setTimeout(() => {
        successStartTimerRef.current = null;
        runSuccessFlourish();
      }, delay);
      return;
    }

    if (successStartTimerRef.current) {
      clearTimeout(successStartTimerRef.current);
      successStartTimerRef.current = null;
    }
    successAnimationRef.current?.stop();
    successAnimationRef.current = null;
    connectPressTimeRef.current = null;
    setButtonVisualState('connect');
  }, [state.phase, runSuccessFlourish]);

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

  const setupCodeInvalid = useMemo(() => {
    const value = state.gatewayConfig.setupCode.trim();
    return value.length > 0 && !decodeSetupCode(value);
  }, [state.gatewayConfig.setupCode]);

  const endpoint = useMemo(() => {
    const scheme = state.gatewayConfig.tls ? 'wss' : 'ws';
    return `${scheme}://${state.gatewayConfig.host}:${state.gatewayConfig.port}`;
  }, [state.gatewayConfig.host, state.gatewayConfig.port, state.gatewayConfig.tls]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.background} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>Connection Control</Text>

          <Text style={styles.heroTitle}>Gateway Connection</Text>
          <Text style={styles.heroSubtitle}>
            One clear action. Open advanced controls only when needed.
          </Text>

          <View style={styles.endpointRow}>
            <Text style={styles.endpointRowLabel}>Active endpoint</Text>
            <Text style={styles.endpointRowValue} numberOfLines={1}>
              {endpoint}
            </Text>
          </View>
        </View>

        <View style={styles.stateRail}>
          <Text style={styles.stateRailLabel}>Gateway state</Text>
          <Text style={styles.stateRailValue}>{state.statusText}</Text>
        </View>

        {state.phase === 'pairing_required' ? (
          <View style={styles.pairingGuide}>
            <Text style={styles.pairingTitle}>Approve this device on gateway host</Text>
            <Text style={styles.pairingHint}>Run these commands:</Text>
            <CodeBlock value="openclaw devices list" />
            <CodeBlock
              value={pairingRequestId ? `openclaw devices approve ${pairingRequestId}` : 'openclaw devices approve'}
            />
          </View>
        ) : null}

        <Pressable
          disabled={primaryDisabled}
          onPress={() => {
            if (buttonVisualState === 'disconnect') {
              actions.disconnect();
              return;
            }
            connectPressTimeRef.current = Date.now();
            setButtonVisualState('connecting');
            void actions.connect();
          }}
          style={({ pressed }) => [
            styles.primaryAction,
            buttonVisualState === 'disconnect' ? styles.primaryActionDanger : styles.primaryActionDefault,
            primaryDisabled ? styles.primaryActionDisabled : undefined,
            pressed && !primaryDisabled ? styles.primaryActionPressed : undefined,
          ]}
        >
          <View style={styles.primaryActionContent}>
            <View style={styles.primaryActionFlourishSlot}>
              {showFlourish ? (
                <View style={styles.primaryActionFlourishRoot} pointerEvents="none">
                  <Animated.View
                    style={[
                      styles.primaryActionFlourishRing,
                      { opacity: successRingOpacity, transform: [{ scale: successRingScale }] },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.primaryActionFlourishCore,
                      { opacity: successCoreOpacity, transform: [{ scale: successCoreScale }] },
                    ]}
                  >
                    <Check size={12} color="#FFFFFF" strokeWidth={2.8} />
                  </Animated.View>
                </View>
              ) : null}
            </View>
            <Text style={styles.primaryActionLabel}>{actionLabel}</Text>
            <View style={styles.primaryActionFlourishSlot} />
          </View>
        </Pressable>

        <Pressable
          onPress={() => setAdvancedOpen((prev) => !prev)}
          style={({ pressed }) => [styles.advancedToggle, pressed ? styles.advancedTogglePressed : undefined]}
        >
          <View style={styles.advancedHeaderCopy}>
            <Text style={styles.advancedTitle}>Advanced controls</Text>
            <Text style={styles.advancedSubtitle}>Setup code, endpoint, TLS, token, password, onboarding.</Text>
          </View>
          {advancedOpen ? (
            <ChevronUp size={18} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={18} color={colors.textSecondary} />
          )}
        </Pressable>

        {advancedOpen ? (
          <View style={styles.advancedPanel}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick setup</Text>
              <Text style={styles.sectionHint}>Setup code auto-applies when valid.</Text>
              <Input
                placeholder="Paste setup code"
                value={state.gatewayConfig.setupCode}
                onChangeText={applySetupCodeInput}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={styles.setupInput}
              />
              {setupCodeInvalid ? (
                <Text style={styles.setupCodeValidation}>Setup code format is invalid.</Text>
              ) : null}
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>TLS</Text>
                <Switch
                  value={state.gatewayConfig.tls}
                  onValueChange={(tls) => actions.setGatewayConfig({ tls })}
                  trackColor={{ false: colors.borderStrong, true: colors.accent }}
                />
              </View>

              <View style={styles.hostPortRow}>
                <View style={styles.hostField}>
                  <Label text="Host" />
                  <Input
                    placeholder="127.0.0.1"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={state.gatewayConfig.host}
                    onChangeText={(host) => actions.setGatewayConfig({ host })}
                  />
                </View>
                <View style={styles.portField}>
                  <Label text="Port" />
                  <Input
                    placeholder="18789"
                    keyboardType="number-pad"
                    value={state.gatewayConfig.port}
                    onChangeText={(port) => actions.setGatewayConfig({ port })}
                  />
                </View>
              </View>

              <View style={styles.singleField}>
                <Label text="Gateway Token" />
                <Input
                  placeholder="Optional token"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={state.gatewayConfig.token}
                  onChangeText={(token) => actions.setGatewayConfig({ token })}
                />
              </View>

              <View style={styles.singleField}>
                <Label text="Gateway Password" />
                <Input
                  placeholder="Optional password"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={state.gatewayConfig.password}
                  onChangeText={(password) => actions.setGatewayConfig({ password })}
                />
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Onboarding</Text>
              <Text style={styles.sectionHint}>Replay first-run setup flow from step one.</Text>
              <Pressable
                onPress={() => {
                  void onResetOnboarding();
                }}
                style={({ pressed }) => [
                  styles.secondaryWideAction,
                  pressed ? styles.secondaryWideActionPressed : undefined,
                ]}
              >
                <Text style={styles.secondaryWideActionLabel}>Run onboarding again</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 124,
  },
  hero: {
    gap: 12,
    paddingTop: 4,
  },
  heroKicker: {
    ...typography.caption1,
    color: colors.textSecondary,
    letterSpacing: 1.05,
    textTransform: 'uppercase',
  },
  heroTitle: {
    ...typography.title1,
    color: colors.text,
    lineHeight: 31,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  endpointRow: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
    paddingTop: 10,
  },
  endpointRowLabel: {
    ...typography.caption2,
    color: colors.textSecondary,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  endpointRowValue: {
    ...typography.mono,
    color: colors.text,
  },
  stateRail: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
    paddingVertical: 12,
  },
  stateRailLabel: {
    ...typography.caption1,
    color: colors.textSecondary,
    letterSpacing: 0.75,
    textTransform: 'uppercase',
  },
  stateRailValue: {
    ...typography.headline,
    color: colors.text,
  },
  pairingGuide: {
    borderLeftColor: colors.accent,
    borderLeftWidth: 2,
    gap: 8,
    paddingLeft: 12,
  },
  pairingTitle: {
    ...typography.headline,
    color: colors.text,
  },
  pairingHint: {
    ...typography.callout,
    color: colors.textSecondary,
  },
  primaryAction: {
    alignItems: 'center',
    ...shadows.sm,
    borderRadius: radii.button,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  primaryActionDefault: {
    backgroundColor: colors.accent,
    borderColor: colors.accentEnd,
  },
  primaryActionDanger: {
    backgroundColor: colors.danger,
    borderColor: colors.dangerEnd,
  },
  primaryActionPressed: {
    transform: [{ scale: 0.985 }],
  },
  primaryActionDisabled: {},
  primaryActionContent: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  primaryActionFlourishSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
  },
  primaryActionFlourishRoot: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  primaryActionFlourishRing: {
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 11,
    borderWidth: 1.25,
    height: 22,
    position: 'absolute',
    width: 22,
  },
  primaryActionFlourishCore: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  primaryActionLabel: {
    ...typography.title3,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  advancedToggle: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 2,
  },
  advancedTogglePressed: {
    opacity: 0.78,
  },
  advancedHeaderCopy: {
    flex: 1,
    paddingRight: 10,
  },
  advancedTitle: {
    ...typography.headline,
    color: colors.text,
  },
  advancedSubtitle: {
    ...typography.callout,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  advancedPanel: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
    paddingTop: 14,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    ...typography.headline,
    color: colors.text,
  },
  sectionHint: {
    ...typography.callout,
    color: colors.textSecondary,
  },
  setupInput: {
    minHeight: 90,
    paddingTop: 14,
  },
  setupCodeValidation: {
    ...typography.caption1,
    color: colors.warning,
  },
  secondaryWideAction: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: radii.button,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  secondaryWideActionPressed: {
    opacity: 0.88,
  },
  secondaryWideActionLabel: {
    ...typography.headline,
    color: colors.accent,
    fontWeight: '700',
  },
  divider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  toggleLabel: {
    ...typography.headline,
    color: colors.text,
  },
  hostPortRow: {
    flexDirection: 'row',
    gap: 10,
  },
  hostField: {
    flex: 2,
    gap: 6,
  },
  portField: {
    flex: 1,
    gap: 6,
  },
  singleField: {
    gap: 6,
  },
});
