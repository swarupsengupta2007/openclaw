import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useAppStore } from '../../app/app-store';
import { colors } from '../../app/theme';
import { ActionButton, Input, Label, Section, SectionTitle } from '../shared/ui';

export function ScreenScreen() {
  const { state } = useAppStore();

  const canvasUrl = `http://${state.gatewayConfig.host || '127.0.0.1'}:${state.gatewayConfig.port || '18789'}/__openclaw__/canvas/`;

  return (
    <View style={styles.container}>
      <Section>
        <SectionTitle title="Canvas" />
        <Label text="Gateway Canvas Host" />
        <Input value={canvasUrl} editable={false} />
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
        <Text style={styles.value}>Gateway: {state.phase}</Text>
        <Text style={styles.value}>Session: {state.sessionKey}</Text>
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    padding: 12,
  },
  note: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  value: {
    color: colors.text,
    fontSize: 14,
  },
});
