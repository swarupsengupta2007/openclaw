import { Monitor } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../../app/theme';

export function ScreenScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Monitor size={14} color={colors.accent} strokeWidth={2} />
        <Text style={styles.badgeLabel}>SCREEN</Text>
      </View>
      <Text style={styles.title}>Coming soon</Text>
      <Text style={styles.copy}>Screen controls are being rebuilt for the next release.</Text>
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
