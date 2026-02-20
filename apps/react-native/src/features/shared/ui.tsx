import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewProps,
} from 'react-native';
import { colors, radii, shadows, typography } from '../../app/theme';

// AIDEV-NOTE: Section `accent` keeps primary blocks visually distinct with a slim brand rail.
// Reserve accent for one critical block per screen.

interface SectionProps extends ViewProps {
  accent?: boolean;
}

export function Section(props: SectionProps) {
  const { children, style, accent, ...rest } = props;
  if (!accent) {
    return (
      <View {...rest} style={[styles.section, style]}>
        {children}
      </View>
    );
  }

  return (
    <View {...rest} style={[styles.section, styles.sectionAccent, style]}>
      <View style={styles.accentBar} />
      <View style={styles.sectionAccentContent}>{children}</View>
    </View>
  );
}

export function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

export function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={colors.textTertiary}
      style={[styles.input, props.style]}
    />
  );
}

export function ActionButton({
  label,
  onPress,
  tone = 'default',
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}) {
  const danger = tone === 'danger';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        danger ? styles.buttonDanger : styles.buttonDefault,
        disabled ? styles.buttonDisabled : undefined,
        pressed && !disabled ? styles.buttonPressed : undefined,
      ]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

export function CodeBlock({ value }: { value: string }) {
  return (
    <View style={styles.codeBlock}>
      <View style={styles.codeAccent} />
      <Text style={styles.codeText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: 14,
    overflow: 'hidden',
    padding: 20,
    ...shadows.sm,
  },
  sectionAccent: {
    backgroundColor: '#FCFDFF',
    flexDirection: 'row',
    paddingLeft: 0,
    paddingVertical: 0,
  },
  sectionAccentContent: {
    flex: 1,
    gap: 14,
    padding: 20,
  },
  accentBar: {
    backgroundColor: colors.accent,
    opacity: 0.4,
    width: 2,
  },
  sectionTitle: {
    ...typography.title2,
    color: colors.text,
  },
  label: {
    ...typography.caption1,
    color: colors.textSecondary,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.input,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  button: {
    alignItems: 'center',
    borderRadius: radii.button,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 20,
    ...shadows.sm,
  },
  buttonDefault: {
    backgroundColor: colors.accent,
    borderColor: colors.accentEnd,
  },
  buttonDanger: {
    backgroundColor: colors.danger,
    borderColor: colors.dangerEnd,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  buttonLabel: {
    ...typography.headline,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  codeBlock: {
    backgroundColor: colors.codeBg,
    borderColor: '#2B2E35',
    borderRadius: radii.code,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  codeAccent: {
    backgroundColor: colors.codeGreen,
    width: 3,
  },
  codeText: {
    ...typography.mono,
    color: colors.codeText,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
