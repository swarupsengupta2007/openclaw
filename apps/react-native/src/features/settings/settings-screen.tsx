import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAppStore } from '../../app/app-store';
import { colors } from '../../app/theme';
import { Label, Section, SectionTitle } from '../shared/ui';

export function SettingsScreen() {
  const { state, actions } = useAppStore();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Section>
        <SectionTitle title="Node Capabilities" />

        <Row
          label="Camera"
          value={state.cameraEnabled}
          onChange={(enabled) => {
            void actions.setCameraEnabled(enabled);
          }}
        />

        <Row
          label="Location"
          value={state.locationEnabled}
          onChange={(enabled) => {
            void actions.setLocationEnabled(enabled);
          }}
        />

        <Row
          label="Voice Wake"
          value={state.voiceWakeEnabled}
          onChange={(enabled) => {
            void actions.setVoiceWakeEnabled(enabled);
          }}
        />

        <Row
          label="Reconnect on launch"
          value={state.reconnectOnLaunch}
          onChange={actions.setReconnectOnLaunch}
        />
      </Section>

      <Section>
        <SectionTitle title="Connection State" />
        <Text style={styles.value}>Phase: {state.phase}</Text>
        <Text style={styles.value}>Status: {state.statusText}</Text>
      </Section>

      <Section>
        <SectionTitle title="Recent Gateway Events" />
        {state.rawEvents.length === 0 ? (
          <Label text="No events yet." />
        ) : (
          state.rawEvents.map((entry) => (
            <Text key={entry} style={styles.eventLine}>
              {entry}
            </Text>
          ))
        )}
      </Section>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    padding: 12,
    paddingBottom: 100,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 42,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  value: {
    color: colors.text,
    fontSize: 14,
  },
  eventLine: {
    color: colors.textMuted,
    fontFamily: 'Courier',
    fontSize: 12,
  },
});
