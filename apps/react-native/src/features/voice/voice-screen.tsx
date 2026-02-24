import { Mic } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../../app/theme';

export function VoiceScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Mic size={14} color={colors.accent} strokeWidth={2} />
        <Text style={styles.badgeLabel}>VOICE</Text>
      </View>
      <Text style={styles.title}>Coming soon</Text>
      <Text style={styles.copy}>Voice controls are being rebuilt. Talk mode returns in the next pass.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 72,
  },
  badge: {
    alignItems: 'center',
    alignSelf: 'center',
    borderColor: colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeLabel: {
    ...typography.caption1,
    color: colors.accent,
    letterSpacing: 0.9,
  },
  title: {
    ...typography.title1,
    color: colors.text,
    textAlign: 'center',
  },
  copy: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
});
