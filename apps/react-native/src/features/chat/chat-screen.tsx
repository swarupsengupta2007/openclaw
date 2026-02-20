import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAppStore } from '../../app/app-store';
import { colors, gradients, radii, shadows, typography } from '../../app/theme';
import { ActionButton, Label, Section } from '../shared/ui';

export function ChatScreen() {
  const { state, actions } = useAppStore();
  const [message, setMessage] = useState('');

  const sortedMessages = useMemo(
    () => [...state.chatMessages].toSorted((a, b) => a.timestamp - b.timestamp),
    [state.chatMessages],
  );

  return (
    <View style={styles.container}>
      <Section>
        <Label text="Session" />
        <Text style={styles.sessionHint}>Live stream + history merge for the selected session key.</Text>
        <View style={styles.sessionChips}>
          {state.sessionOptions.map((sessionKey) => {
            const active = sessionKey === state.sessionKey;
            return (
              <Pressable
                key={sessionKey}
                onPress={() => {
                  actions.setSessionKey(sessionKey);
                  void actions.refreshHistory();
                }}
                style={[styles.sessionChip, active ? styles.sessionChipActive : undefined]}
              >
                {active ? (
                  <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sessionChipGradient}>
                    <Text style={styles.sessionChipTextActive}>{sessionKey}</Text>
                  </LinearGradient>
                ) : (
                  <Text style={styles.sessionChipText}>{sessionKey}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </Section>

      <FlatList
        data={sortedMessages}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.bubble, bubbleStyle(item.role)]}>
            <Text style={styles.bubbleRole}>{item.role.toUpperCase()}</Text>
            <Text style={styles.bubbleText}>{item.text}</Text>
          </View>
        )}
        ListFooterComponent={
          state.chatStream.trim() ? (
            <View style={[styles.bubble, styles.bubbleAssistant]}>
              <Text style={styles.bubbleRole}>ASSISTANT (STREAM)</Text>
              <Text style={styles.bubbleText}>{state.chatStream}</Text>
            </View>
          ) : null
        }
      />

      <View style={styles.composer}>
        <TextInput
          placeholder="Message"
          placeholderTextColor={colors.textTertiary}
          value={message}
          onChangeText={setMessage}
          style={styles.composerInput}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.composerActions}>
          <ActionButton label="Refresh" onPress={() => void actions.refreshHistory()} disabled={state.chatLoading} />
          <ActionButton
            label="Abort"
            onPress={() => void actions.abortRun()}
            disabled={!state.chatRunId}
            tone="danger"
          />
          <ActionButton
            label="Send"
            onPress={() => {
              const next = message.trim();
              if (!next) {
                return;
              }
              setMessage('');
              void actions.sendChatMessage(next);
            }}
            disabled={state.chatSending}
          />
        </View>
      </View>
    </View>
  );
}

function bubbleStyle(role: string) {
  if (role === 'user') {
    return styles.bubbleUser;
  }
  if (role === 'assistant') {
    return styles.bubbleAssistant;
  }
  return styles.bubbleSystem;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    padding: 20,
    paddingBottom: 100,
  },
  sessionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sessionHint: {
    ...typography.callout,
    color: colors.textSecondary,
  },
  sessionChip: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  sessionChipActive: {
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  sessionChipGradient: {
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  sessionChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  sessionChipTextActive: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    gap: 10,
    paddingBottom: 8,
  },
  bubble: {
    borderRadius: radii.card,
    gap: 6,
    padding: 14,
    ...shadows.sm,
  },
  bubbleUser: {
    backgroundColor: colors.accentSoft,
  },
  bubbleAssistant: {
    backgroundColor: colors.card,
  },
  bubbleSystem: {
    backgroundColor: colors.warningSoft,
  },
  bubbleRole: {
    ...typography.caption2,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  bubbleText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  composer: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    gap: 12,
    padding: 16,
    ...shadows.md,
  },
  composerInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    color: colors.text,
    minHeight: 80,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  composerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
