import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAppStore } from '../../app/app-store';
import { colors, gradients, radii, shadows, typography } from '../../app/theme';
import { CodeBlock, Input, Label } from '../shared/ui';

function extractRequestId(text: string): string | null {
  const match = text.match(/requestid[:=]\s*([a-z0-9-]+)/i);
  return match?.[1] ?? null;
}

export function ConnectScreen({ onResetOnboarding }: { onResetOnboarding: () => Promise<void> }) {
  const { state, actions } = useAppStore();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const pairingRequestId = state.phase === 'pairing_required' ? extractRequestId(state.statusText) : null;
  const isConnected = state.phase === 'connected' || state.phase === 'connecting';
  const actionLabel = isConnected ? 'Disconnect Gateway' : 'Connect Gateway';
  const actionHint = isConnected ? 'End active session cleanly' : 'Start secure session';

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

          <Text style={styles.heroTitle}>Gateway{'\n'}Command Deck</Text>
          <Text style={styles.heroSubtitle}>
            One clear action. Live state context. Advanced controls only when you ask for them.
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
            <CodeBlock value="openclaw devices list" />
            <CodeBlock
              value={pairingRequestId ? `openclaw devices approve ${pairingRequestId}` : 'openclaw devices approve'}
            />
          </View>
        ) : null}

        <Pressable
          onPress={isConnected ? actions.disconnect : () => void actions.connect()}
          style={({ pressed }) => [styles.primaryActionShell, pressed ? styles.primaryActionPressed : undefined]}
        >
          <View style={[styles.primaryAction, isConnected ? styles.primaryActionDanger : styles.primaryActionDefault]}>
            <Text style={styles.primaryActionLabel}>{actionLabel}</Text>
            <Text style={styles.primaryActionHint}>{actionHint}</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setAdvancedOpen((prev) => !prev)}
          style={({ pressed }) => [styles.advancedToggle, pressed ? styles.advancedTogglePressed : undefined]}
        >
          <View style={styles.advancedHeaderCopy}>
            <Text style={styles.advancedTitle}>Advanced controls</Text>
            <Text style={styles.advancedSubtitle}>Setup code, endpoint overrides, TLS, token, password.</Text>
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
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Quick setup</Text>
                <Pressable
                  onPress={actions.applySetupCode}
                  style={({ pressed }) => [styles.inlineAction, pressed ? styles.inlineActionPressed : undefined]}
                >
                  <Text style={styles.inlineActionText}>Apply</Text>
                </Pressable>
              </View>
              <Input
                placeholder="Paste setup code"
                value={state.gatewayConfig.setupCode}
                onChangeText={(setupCode) => actions.setGatewayConfig({ setupCode })}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={styles.setupInput}
              />
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
                style={({ pressed }) => [styles.inlineAction, pressed ? styles.inlineActionPressed : undefined]}
              >
                <Text style={styles.inlineActionText}>Run onboarding again</Text>
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
    lineHeight: 32,
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
    gap: 8,
  },
  pairingTitle: {
    ...typography.caption1,
    color: colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  primaryActionShell: {
    borderRadius: 18,
    ...shadows.md,
  },
  primaryAction: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderWidth: 1,
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 64,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryActionDefault: {
    backgroundColor: colors.accent,
    borderColor: '#184DAF',
  },
  primaryActionDanger: {
    backgroundColor: colors.danger,
    borderColor: '#B94444',
  },
  primaryActionPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.992 }],
  },
  primaryActionLabel: {
    ...typography.title3,
    color: '#FFFFFF',
  },
  primaryActionHint: {
    ...typography.caption1,
    color: '#DEE9FF',
    letterSpacing: 0.25,
    marginTop: 2,
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
  },
  advancedPanel: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 14,
    paddingTop: 14,
  },
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.title3,
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
  inlineAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: colors.borderStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 12,
  },
  inlineActionPressed: {
    opacity: 0.72,
  },
  inlineActionText: {
    ...typography.caption1,
    color: colors.accent,
    letterSpacing: 0.2,
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
