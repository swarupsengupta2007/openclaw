import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useAppStore } from '../../app/app-store';
import { colors } from '../../app/theme';
import { Section, SectionTitle } from '../shared/ui';

export function VoiceScreen() {
  const { state, actions } = useAppStore();

  return (
    <View style={styles.container}>
      <Section>
        <SectionTitle title="Realtime Conversation" />

        <View style={styles.row}>
          <Text style={styles.label}>Talk Mode</Text>
          <Switch value={state.talkEnabled} onValueChange={(enabled) => void actions.setTalkEnabled(enabled)} />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Voice Wake</Text>
          <Switch value={state.voiceWakeEnabled} onValueChange={(enabled) => void actions.setVoiceWakeEnabled(enabled)} />
        </View>

        <Text style={styles.note}>
          PTT capture/streaming transport is next milestone. This screen already syncs talk mode state with the
          gateway.
        </Text>
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  note: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
});
