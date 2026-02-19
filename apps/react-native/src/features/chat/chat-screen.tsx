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
import { colors } from '../../app/theme';
import { ActionButton, Label, Section } from '../shared/ui';

export function ChatScreen() {
  const { state, actions } = useAppStore();
  const [message, setMessage] = useState('');

  const sortedMessages = useMemo(
    () => [...state.chatMessages].sort((a, b) => a.timestamp - b.timestamp),
    [state.chatMessages],
  );

  return (
    <View style={styles.container}>
      <Section style={styles.sessionSection}>
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
                <Text style={active ? styles.sessionChipTextActive : styles.sessionChipText}>{sessionKey}</Text>
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

      <Section>
        <TextInput
          placeholder="Message"
          placeholderTextColor={colors.textMuted}
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
      </Section>
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
    padding: 12,
    paddingBottom: 100,
  },
  sessionSection: {
    gap: 10,
  },
  sessionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sessionHint: {
    color: colors.textMuted,
    fontSize: 12,
  },
  sessionChip: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sessionChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  sessionChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  sessionChipTextActive: {
    color: '#071711',
    fontSize: 12,
    fontWeight: '700',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    gap: 8,
    paddingBottom: 8,
  },
  bubble: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 10,
  },
  bubbleUser: {
    backgroundColor: '#113022',
    borderColor: '#1A4935',
  },
  bubbleAssistant: {
    backgroundColor: '#1A2232',
    borderColor: '#2A3B57',
  },
  bubbleSystem: {
    backgroundColor: '#302718',
    borderColor: '#5E4725',
  },
  bubbleRole: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  bubbleText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  composerInput: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    minHeight: 84,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  composerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
});
