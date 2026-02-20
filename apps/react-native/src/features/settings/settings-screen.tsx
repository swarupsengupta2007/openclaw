import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAppStore } from '../../app/app-store';
import { colors, radii, typography } from '../../app/theme';
import { ActionButton, Section, SectionTitle } from '../shared/ui';

export function SettingsScreen({ onResetOnboarding }: { onResetOnboarding: () => Promise<void> }) {
  const { state, actions } = useAppStore();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Section>
        <SectionTitle title="Node Capabilities" />

        <Row
          label="Camera"
          hint="Camera-based capability registration"
          value={state.cameraEnabled}
          onChange={(enabled) => {
            void actions.setCameraEnabled(enabled);
          }}
        />

        <View style={styles.divider} />

        <Row
          label="Location"
          hint="Location-related agent tools"
          value={state.locationEnabled}
          onChange={(enabled) => {
            void actions.setLocationEnabled(enabled);
          }}
        />

        <View style={styles.divider} />

        <Row
          label="Voice Wake"
          hint="Wake-word flow on supported setups"
          value={state.voiceWakeEnabled}
          onChange={(enabled) => {
            void actions.setVoiceWakeEnabled(enabled);
          }}
        />

        <View style={styles.divider} />

        <Row
          label="Reconnect on launch"
          hint="Auto-connect when app starts"
          value={state.reconnectOnLaunch}
          onChange={actions.setReconnectOnLaunch}
        />
      </Section>

      <Section accent>
        <SectionTitle title="Connection State" />
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Phase</Text>
            <Text style={styles.statusValue}>{state.phase}</Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={styles.statusValue} numberOfLines={2}>{state.statusText}</Text>
          </View>
        </View>
      </Section>

      <Section>
        <SectionTitle title="Recent Gateway Events" />
        {state.rawEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No events yet</Text>
          </View>
        ) : (
          <View style={styles.eventLog}>
            {state.rawEvents.map((entry) => (
              <Text key={entry} style={styles.eventLine}>
                {entry}
              </Text>
            ))}
          </View>
        )}
      </Section>

      <Section>
        <SectionTitle title="Onboarding" />
        <Text style={styles.onboardingHint}>Replay first-run setup flow from step one.</Text>
        <ActionButton
          label="Reset Onboarding"
          onPress={() => {
            void onResetOnboarding();
          }}
        />
      </Section>
    </ScrollView>
  );
}

function Row({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
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
  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 100,
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
  rowLabel: {
    ...typography.headline,
    color: colors.text,
  },
  rowHint: {
    ...typography.callout,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    ...typography.callout,
    color: colors.textTertiary,
  },
  eventLog: {
    backgroundColor: colors.codeBg,
    borderRadius: radii.code,
    gap: 2,
    maxHeight: 300,
    padding: 12,
  },
  eventLine: {
    ...typography.mono,
    color: colors.codeText,
    lineHeight: 20,
  },
  onboardingHint: {
    ...typography.callout,
    color: colors.textSecondary,
  },
});
