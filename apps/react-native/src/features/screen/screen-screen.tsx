import { LinearGradient } from 'expo-linear-gradient';
import { Monitor } from 'lucide-react-native';
import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useAppStore } from '../../app/app-store';
import { colors, gradients, shadows, typography } from '../../app/theme';
import { ActionButton, Input, Section, SectionTitle } from '../shared/ui';

export function ScreenScreen() {
  const { state } = useAppStore();

  const canvasUrl = `http://${state.gatewayConfig.host || '127.0.0.1'}:${state.gatewayConfig.port || '18789'}/__openclaw__/canvas/`;

  return (
    <View style={styles.container}>
      {/* Visual hero */}
      <View style={styles.hero}>
        <LinearGradient
          colors={gradients.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroIcon}
        >
          <Monitor size={32} color="#FFFFFF" strokeWidth={2} />
        </LinearGradient>
        <Text style={styles.heroTitle}>Canvas</Text>
        <Text style={styles.heroSubtitle}>Gateway screen sharing & display</Text>
      </View>

      <Section accent>
        <SectionTitle title="Canvas URL" />
        <Input value={canvasUrl} editable={false} style={styles.monoInput} />
        <ActionButton
          label="Open Canvas URL"
          onPress={() => {
            void Linking.openURL(canvasUrl);
          }}
        />
        <Text style={styles.note}>
          Embedded WebView parity will land in the next pass. Use this to verify canvas host reachability now.
        </Text>
      </Section>

      <Section>
        <SectionTitle title="Status" />
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Gateway</Text>
            <Text style={styles.statusValue}>{state.phase}</Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Session</Text>
            <Text style={styles.statusValue}>{state.sessionKey}</Text>
          </View>
        </View>
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
    padding: 20,
  },
  hero: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  heroIcon: {
    alignItems: 'center',
    borderRadius: 24,
    height: 72,
    justifyContent: 'center',
    marginBottom: 4,
    width: 72,
    ...shadows.lg,
  },
  heroTitle: {
    ...typography.title1,
    color: colors.text,
  },
  heroSubtitle: {
    ...typography.callout,
    color: colors.textSecondary,
  },
  note: {
    ...typography.callout,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  monoInput: {
    ...typography.mono,
  },
  statusRow: {
    flexDirection: 'row',
  },
  statusItem: {
    flex: 1,
    gap: 4,
  },
  statusDivider: {
    backgroundColor: colors.border,
    marginHorizontal: 12,
    width: StyleSheet.hairlineWidth,
  },
  statusLabel: {
    ...typography.caption1,
    color: colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statusValue: {
    ...typography.headline,
    color: colors.text,
  },
});
