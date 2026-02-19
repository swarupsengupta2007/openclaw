import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewProps,
} from 'react-native';
import { colors, gradients, radii } from '../../app/theme';

export function Section(props: ViewProps) {
  const { children, style, ...rest } = props;
  return (
    <LinearGradient colors={gradients.card} style={[styles.section, style]}>
      <View {...rest} style={styles.sectionContent}>
        {children}
      </View>
    </LinearGradient>
  );
}

export function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

export function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

export function Input(props: TextInputProps) {
  return <TextInput {...props} placeholderTextColor={colors.textMuted} style={[styles.input, props.style]} />;
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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.buttonWrap, disabled ? styles.buttonDisabled : undefined, pressed && !disabled ? styles.buttonPressed : undefined]}
    >
      <LinearGradient
        colors={tone === 'danger' ? gradients.buttonDanger : gradients.buttonPrimary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.button}
      >
        <Text style={styles.buttonLabel}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: 8,
    padding: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  sectionContent: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'rgba(16,24,38,0.84)',
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  buttonWrap: {
    borderRadius: radii.button,
  },
  button: {
    borderRadius: radii.button,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  buttonLabel: {
    color: '#041611',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
