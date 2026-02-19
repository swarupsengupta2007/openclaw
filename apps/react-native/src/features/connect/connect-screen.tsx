import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAppStore } from '../../app/app-store';
import { colors } from '../../app/theme';
import { ActionButton, Input, Label, Section, SectionTitle } from '../shared/ui';

function extractRequestId(text: string): string | null {
  const match = text.match(/requestid[:=]\s*([a-z0-9-]+)/i);
  return match?.[1] ?? null;
}

export function ConnectScreen() {
  const { state, actions } = useAppStore();

  const isConnected = state.phase === 'connected' || state.phase === 'connecting';
  const pairingRequestId = state.phase === 'pairing_required' ? extractRequestId(state.statusText) : null;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Section>
        <SectionTitle title="Pair + Connect" />
        <Text style={styles.statusSubtle}>
          Node role + operator role connect together. Pairing/auth failures pause reconnect loops until fixed.
        </Text>
      </Section>

      <Section>
        <SectionTitle title="Gateway" />
        <Label text="Status" />
        <Text style={styles.statusText}>{state.statusText}</Text>
        {state.phase === 'pairing_required' ? (
          <View style={styles.pairingCard}>
            <Text style={styles.statusSubtle}>Run on gateway host:</Text>
            <Text style={styles.codeLine}>openclaw devices list</Text>
            <Text style={styles.codeLine}>
              {pairingRequestId ? `openclaw devices approve ${pairingRequestId}` : 'openclaw devices approve'}
            </Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Label text="TLS" />
          <Switch value={state.gatewayConfig.tls} onValueChange={(tls) => actions.setGatewayConfig({ tls })} />
        </View>
      </Section>

      <Section>
        <SectionTitle title="Setup Code" />
        <Input
          placeholder="Paste setup code"
          value={state.gatewayConfig.setupCode}
          onChangeText={(setupCode) => actions.setGatewayConfig({ setupCode })}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        <ActionButton label="Apply Setup Code" onPress={actions.applySetupCode} />
      </Section>

      <Section>
        <SectionTitle title="Manual Connect" />
        <Label text="Host" />
        <Input
          placeholder="127.0.0.1"
          autoCapitalize="none"
          autoCorrect={false}
          value={state.gatewayConfig.host}
          onChangeText={(host) => actions.setGatewayConfig({ host })}
        />

        <Label text="Port" />
        <Input
          placeholder="18789"
          keyboardType="number-pad"
          value={state.gatewayConfig.port}
          onChangeText={(port) => actions.setGatewayConfig({ port })}
        />

        <Label text="Gateway Token (optional)" />
        <Input
          placeholder="token"
          autoCapitalize="none"
          autoCorrect={false}
          value={state.gatewayConfig.token}
          onChangeText={(token) => actions.setGatewayConfig({ token })}
        />

        <Label text="Gateway Password (optional)" />
        <Input
          placeholder="password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={state.gatewayConfig.password}
          onChangeText={(password) => actions.setGatewayConfig({ password })}
        />

        {isConnected ? (
          <ActionButton label="Disconnect" tone="danger" onPress={actions.disconnect} />
        ) : (
          <ActionButton label="Connect" onPress={() => void actions.connect()} />
        )}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    padding: 12,
    paddingBottom: 120,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusText: {
    color: colors.text,
    fontSize: 15,
  },
  statusSubtle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  pairingCard: {
    backgroundColor: 'rgba(17,32,46,0.7)',
    borderColor: 'rgba(67,102,146,0.55)',
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    marginTop: 8,
    padding: 10,
  },
  codeLine: {
    backgroundColor: 'rgba(9,15,25,0.92)',
    borderColor: 'rgba(42,61,94,0.9)',
    borderRadius: 10,
    borderWidth: 1,
    color: '#CAE0FF',
    fontFamily: 'Courier',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
