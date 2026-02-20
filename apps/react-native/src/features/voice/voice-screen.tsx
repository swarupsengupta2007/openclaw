import { LinearGradient } from 'expo-linear-gradient';
import { Mic } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useAppStore } from '../../app/app-store';
import { colors, gradients, radii, shadows, typography } from '../../app/theme';
import { Section, SectionTitle } from '../shared/ui';

export function VoiceScreen() {
  const { state, actions } = useAppStore();

  return (
    <View style={styles.container}>
      {/* Visual hero element */}
      <View style={styles.hero}>
        <LinearGradient
          colors={gradients.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroIcon}
        >
          <Mic size={32} color="#FFFFFF" strokeWidth={2} />
        </LinearGradient>
        <Text style={styles.heroTitle}>Voice</Text>
        <Text style={styles.heroSubtitle}>Realtime conversation controls</Text>
      </View>

      <Section>
        <SectionTitle title="Capabilities" />

        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.label}>Talk Mode</Text>
            <Text style={styles.hint}>Keep gateway voice session interactive.</Text>
          </View>
          <Switch
            value={state.talkEnabled}
            onValueChange={(enabled) => void actions.setTalkEnabled(enabled)}
            trackColor={{ false: colors.border, true: colors.accent }}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.label}>Voice Wake</Text>
            <Text style={styles.hint}>Allow wake-word flow on supported setups.</Text>
          </View>
          <Switch
            value={state.voiceWakeEnabled}
            onValueChange={(enabled) => void actions.setVoiceWakeEnabled(enabled)}
            trackColor={{ false: colors.border, true: colors.accent }}
          />
        </View>
      </Section>

      <View style={styles.noteCard}>
        <Text style={styles.note}>
          PTT capture/streaming transport is next milestone. This screen already syncs talk mode state with the
          gateway.
        </Text>
      </View>
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
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  rowContent: {
    flex: 1,
    paddingRight: 12,
  },
  label: {
    ...typography.headline,
    color: colors.text,
  },
  hint: {
    ...typography.callout,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
  },
  noteCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
  },
  note: {
    ...typography.callout,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
