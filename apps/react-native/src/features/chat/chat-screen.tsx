import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, ChevronUp, Cpu, Plus, RefreshCw, SendHorizontal, Square } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { ChatMessage } from '../../app/app-store';
import { useAppStore } from '../../app/app-store';
import { colors, gradients, radii, typography } from '../../app/theme';
import type { ConnectionPhase } from '../../gateway/sessions';

type ThreadItem = ChatMessage | (ChatMessage & { streaming: true });

const autoScrollThreshold = 96;
const sessionChipLabelMaxLength = 20;
const modelLabelMaxLength = 26;

function chatDisabledReason(phase: ConnectionPhase, statusText: string): string {
  if (phase === 'connecting') {
    return 'Connecting to gateway. Sending is locked until ready.';
  }
  if (phase === 'pairing_required') {
    return 'Pair this device in Connect before sending messages.';
  }
  if (phase === 'auth_required') {
    return 'Auth required. Update gateway token/password in Connect.';
  }
  if (phase === 'error') {
    return statusText;
  }
  return 'Gateway is offline. Connect first in the Connect tab.';
}

function sortByTime(messages: ChatMessage[]): ChatMessage[] {
  const sorted: ChatMessage[] = [];
  for (const message of messages) {
    let insertAt = sorted.length;
    while (insertAt > 0 && sorted[insertAt - 1].timestamp > message.timestamp) {
      insertAt -= 1;
    }
    sorted.splice(insertAt, 0, message);
  }
  return sorted;
}

function shortSessionLabel(sessionKey: string): string {
  if (sessionKey.length <= sessionChipLabelMaxLength) {
    return sessionKey;
  }
  return `${sessionKey.slice(0, sessionChipLabelMaxLength - 1)}…`;
}

function shortModelLabel(modelRef: string): string {
  if (modelRef.length <= modelLabelMaxLength) {
    return modelRef;
  }
  return `${modelRef.slice(0, modelLabelMaxLength - 1)}…`;
}

export function ChatScreen() {
  const { state, actions } = useAppStore();
  const [draft, setDraft] = useState('');
  const [showSystemEvents, setShowSystemEvents] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const listRef = useRef<FlatList<ThreadItem>>(null);
  const shouldStickToBottomRef = useRef(true);

  const connected = state.phase === 'connected';
  const disabledReason = connected ? null : chatDisabledReason(state.phase, state.statusText);

  const sortedMessages = useMemo(() => sortByTime(state.chatMessages), [state.chatMessages]);

  const hasSystemEvents = useMemo(
    () => sortedMessages.some((message) => message.role === 'system'),
    [sortedMessages],
  );

  const visibleMessages = useMemo(() => {
    if (showSystemEvents) {
      return sortedMessages;
    }
    return sortedMessages.filter((message) => message.role !== 'system');
  }, [showSystemEvents, sortedMessages]);

  const threadItems = useMemo<ThreadItem[]>(() => {
    const streamText = state.chatStream.trim();
    if (!streamText) {
      return visibleMessages;
    }

    return [
      ...visibleMessages,
      {
        id: 'assistant-stream',
        role: 'assistant',
        text: streamText,
        timestamp: Date.now(),
        streaming: true,
      },
    ];
  }, [state.chatStream, visibleMessages]);

  const sendDisabled = !connected || state.chatSending || Boolean(state.chatRunId) || draft.trim().length === 0;
  const sendBusy = connected && Boolean(state.chatSending || state.chatRunId);
  const sessionCommandDisabled = !connected || state.chatSending || Boolean(state.chatRunId);
  const abortDisabled = !connected || !state.chatRunId;
  const refreshDisabled = !connected || state.chatLoading;
  const inputDisabled = !connected || state.chatSending;

  const scrollToBottom = useCallback((animated: boolean) => {
    listRef.current?.scrollToEnd({ animated });
  }, []);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      const animated = state.chatStream.trim().length === 0;
      scrollToBottom(animated);
    }, 0);

    return () => clearTimeout(timer);
  }, [state.chatStream, threadItems.length, scrollToBottom]);

  useEffect(() => {
    if (!connected) {
      return;
    }
    if (state.modelOptions.length > 0) {
      return;
    }
    void actions.refreshModels();
  }, [actions, connected, state.modelOptions.length]);

  const onThreadScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    shouldStickToBottomRef.current = distanceFromBottom <= autoScrollThreshold;
  }, []);

  const onDraftChange = useCallback((nextDraft: string) => {
    setDraft(nextDraft);
    if (nextDraft.trim().length > 0 && state.chatError) {
      actions.clearChatError();
    }
  }, [actions, state.chatError]);

  const onSelectSession = useCallback((sessionKey: string) => {
    if (sessionKey === state.sessionKey) {
      return;
    }
    actions.setSessionKey(sessionKey);
    actions.clearChatError();
    void actions.refreshHistory();
  }, [actions, state.sessionKey]);

  const onSend = useCallback(() => {
    const message = draft.trim();
    if (!message || sendDisabled) {
      return;
    }

    setDraft('');
    actions.clearChatError();
    void actions.sendChatMessage(message);
  }, [actions, draft, sendDisabled]);

  const onStartNewSession = useCallback(() => {
    if (sessionCommandDisabled) {
      return;
    }
    actions.clearChatError();
    setShowModelPicker(false);
    void actions.startNewSession();
  }, [actions, sessionCommandDisabled]);

  const onToggleModelPicker = useCallback(() => {
    if (!showModelPicker && state.modelOptions.length === 0) {
      void actions.refreshModels();
    }
    setShowModelPicker((prev) => !prev);
  }, [actions, showModelPicker, state.modelOptions.length]);

  const onSelectModel = useCallback((modelRef: string) => {
    if (sessionCommandDisabled) {
      return;
    }
    actions.clearChatError();
    setShowModelPicker(false);
    void actions.selectModel(modelRef);
  }, [actions, sessionCommandDisabled]);

  const onAbort = useCallback(() => {
    if (abortDisabled) {
      return;
    }
    void actions.abortRun();
  }, [actions, abortDisabled]);

  const onRefresh = useCallback(() => {
    if (refreshDisabled) {
      return;
    }
    actions.clearChatError();
    void actions.refreshHistory();
  }, [actions, refreshDisabled]);

  const modelSelectionLabel = state.selectedModel ? shortModelLabel(state.selectedModel) : 'Select model';

  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.background} style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.sessionSection}>
            <View style={styles.sessionMetaRow}>
              <Text style={styles.sessionLabel}>Session</Text>
              <View style={styles.sessionMetaRight}>
                <Text style={styles.sessionValue}>{shortSessionLabel(state.sessionKey)}</Text>
                {hasSystemEvents ? (
                  <Pressable
                    onPress={() => setShowSystemEvents((prev) => !prev)}
                    style={({ pressed }) => [
                      styles.systemToggleChip,
                      showSystemEvents ? styles.systemToggleChipActive : undefined,
                      pressed ? styles.systemToggleChipPressed : undefined,
                    ]}
                  >
                    <Text style={showSystemEvents ? styles.systemToggleChipTextActive : styles.systemToggleChipText}>
                      {showSystemEvents ? 'System on' : 'System off'}
                    </Text>
                    {showSystemEvents ? (
                      <ChevronUp size={12} color={colors.accent} />
                    ) : (
                      <ChevronDown size={12} color={colors.textSecondary} />
                    )}
                  </Pressable>
                ) : null}
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionRail}>
              {state.sessionOptions.map((sessionKey) => {
                const active = sessionKey === state.sessionKey;
                return (
                  <Pressable
                    key={sessionKey}
                    onPress={() => onSelectSession(sessionKey)}
                    style={({ pressed }) => [
                      styles.sessionButton,
                      active ? styles.sessionButtonActive : undefined,
                      pressed ? styles.sessionButtonPressed : undefined,
                    ]}
                  >
                    <Text style={active ? styles.sessionButtonTextActive : styles.sessionButtonText}>
                      {shortSessionLabel(sessionKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.sessionControlsRow}>
              <Pressable
                onPress={onStartNewSession}
                disabled={sessionCommandDisabled}
                style={({ pressed }) => [
                  styles.sessionControlButton,
                  sessionCommandDisabled ? styles.sessionControlButtonDisabled : undefined,
                  pressed && !sessionCommandDisabled ? styles.sessionControlButtonPressed : undefined,
                ]}
              >
                <Plus size={14} color={sessionCommandDisabled ? colors.textTertiary : colors.textSecondary} />
                <Text style={sessionCommandDisabled ? styles.sessionControlTextDisabled : styles.sessionControlText}>
                  New session
                </Text>
              </Pressable>

              <Pressable
                onPress={onToggleModelPicker}
                disabled={!connected}
                style={({ pressed }) => [
                  styles.modelToggleButton,
                  !connected ? styles.sessionControlButtonDisabled : undefined,
                  pressed && connected ? styles.sessionControlButtonPressed : undefined,
                ]}
              >
                <Cpu size={14} color={!connected ? colors.textTertiary : colors.textSecondary} />
                <Text style={!connected ? styles.sessionControlTextDisabled : styles.modelToggleText}>
                  {modelSelectionLabel}
                </Text>
                {showModelPicker ? (
                  <ChevronUp size={12} color={!connected ? colors.textTertiary : colors.textSecondary} />
                ) : (
                  <ChevronDown size={12} color={!connected ? colors.textTertiary : colors.textSecondary} />
                )}
              </Pressable>
            </View>

            {showModelPicker ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modelRail}>
                {state.modelOptions.length === 0 ? (
                  <View style={styles.modelEmptyPill}>
                    <Text style={styles.modelEmptyText}>No models available</Text>
                  </View>
                ) : (
                  state.modelOptions.map((modelRef) => {
                    const active = modelRef === state.selectedModel;
                    return (
                      <Pressable
                        key={modelRef}
                        onPress={() => onSelectModel(modelRef)}
                        disabled={sessionCommandDisabled}
                        style={({ pressed }) => [
                          styles.modelChip,
                          active ? styles.modelChipActive : undefined,
                          sessionCommandDisabled ? styles.sessionControlButtonDisabled : undefined,
                          pressed && !sessionCommandDisabled ? styles.sessionControlButtonPressed : undefined,
                        ]}
                      >
                        <Text style={active ? styles.modelChipTextActive : styles.modelChipText}>
                          {shortModelLabel(modelRef)}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            ) : null}
          </View>

          {state.chatError ? (
            <View style={styles.errorRail}>
              <Text style={styles.errorLabel}>Chat error</Text>
              <Text style={styles.errorText}>{state.chatError}</Text>
            </View>
          ) : null}

          <FlatList
            ref={listRef}
            data={threadItems}
            keyExtractor={(item) => item.id}
            style={styles.threadList}
            contentContainerStyle={styles.threadContent}
            onScroll={onThreadScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const streaming = 'streaming' in item;
              const role = item.role;
              const roleLabel = streaming ? 'Assistant · Live' : role[0].toUpperCase() + role.slice(1);

              return (
                <View
                  style={[
                    styles.messageRow,
                    role === 'user'
                      ? styles.messageRowUser
                      : role === 'assistant'
                        ? styles.messageRowAssistant
                        : styles.messageRowSystem,
                    streaming ? styles.messageRowStreaming : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageRole,
                      role === 'user'
                        ? styles.messageRoleUser
                        : role === 'assistant'
                          ? styles.messageRoleAssistant
                          : styles.messageRoleSystem,
                    ]}
                  >
                    {roleLabel}
                  </Text>
                  <Text style={styles.messageText}>{item.text}</Text>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptyBody}>
                  {connected ? 'Send the first prompt to start this session.' : 'Connect gateway first, then return to chat.'}
                </Text>
              </View>
            }
          />

          <View style={styles.composer}>
            <Text style={styles.composerLabel}>Message</Text>
            <TextInput
              value={draft}
              onChangeText={onDraftChange}
              style={styles.composerInput}
              placeholder={connected ? 'Type a message' : 'Messaging locked while gateway is offline'}
              placeholderTextColor={colors.textTertiary}
              multiline
              textAlignVertical="top"
              editable={!inputDisabled}
            />

            {disabledReason ? <Text style={styles.disabledReason}>{disabledReason}</Text> : null}

            <View style={styles.composerActions}>
              <View style={styles.secondaryActions}>
                <Pressable
                  onPress={onRefresh}
                  disabled={refreshDisabled}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    refreshDisabled ? styles.secondaryButtonDisabled : undefined,
                    pressed && !refreshDisabled ? styles.secondaryButtonPressed : undefined,
                  ]}
                >
                  <RefreshCw size={14} color={refreshDisabled ? colors.textTertiary : colors.textSecondary} />
                  <Text style={refreshDisabled ? styles.secondaryButtonLabelDisabled : styles.secondaryButtonLabel}>Refresh</Text>
                </Pressable>

                  <Pressable
                    onPress={onAbort}
                    disabled={abortDisabled}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      abortDisabled ? styles.secondaryButtonDisabled : undefined,
                      pressed && !abortDisabled ? styles.secondaryButtonPressed : undefined,
                    ]}
                  >
                    <Square size={13} color={abortDisabled ? colors.textTertiary : colors.textSecondary} />
                    <Text style={abortDisabled ? styles.secondaryButtonLabelDisabled : styles.secondaryButtonLabel}>Abort</Text>
                  </Pressable>
                </View>

              <Pressable
                onPress={onSend}
                disabled={sendDisabled}
                style={({ pressed }) => [
                  styles.primaryButton,
                  sendDisabled ? styles.primaryButtonDisabled : undefined,
                  pressed && !sendDisabled ? styles.primaryButtonPressed : undefined,
                ]}
              >
                {sendBusy ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : (
                  <SendHorizontal size={16} color={sendDisabled ? colors.textTertiary : colors.card} />
                )}
                <Text style={sendDisabled ? styles.primaryButtonLabelDisabled : styles.primaryButtonLabel}>Send</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  content: {
    flex: 1,
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  sessionSection: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
    paddingBottom: 8,
  },
  sessionMetaRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sessionMetaRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sessionLabel: {
    ...typography.caption1,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sessionValue: {
    ...typography.callout,
    color: colors.text,
    fontWeight: '600',
  },
  sessionRail: {
    gap: 8,
    paddingRight: 4,
  },
  sessionButton: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: radii.button,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 12,
  },
  sessionButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accentEnd,
  },
  sessionButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  sessionButtonText: {
    ...typography.caption1,
    color: colors.text,
    fontWeight: '600',
  },
  sessionButtonTextActive: {
    ...typography.caption1,
    color: colors.card,
    fontWeight: '700',
  },
  sessionControlsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sessionControlButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.borderStrong,
    borderRadius: radii.button,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 12,
  },
  sessionControlButtonDisabled: {
    opacity: 0.62,
  },
  sessionControlButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
  sessionControlText: {
    ...typography.caption1,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  sessionControlTextDisabled: {
    ...typography.caption1,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  modelToggleButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.borderStrong,
    borderRadius: radii.button,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 10,
  },
  modelToggleText: {
    ...typography.caption1,
    color: colors.text,
    flex: 1,
    fontWeight: '600',
  },
  modelRail: {
    gap: 8,
    paddingRight: 4,
  },
  modelChip: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: radii.button,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 10,
  },
  modelChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accentEnd,
  },
  modelChipText: {
    ...typography.caption2,
    color: colors.text,
    fontWeight: '600',
  },
  modelChipTextActive: {
    ...typography.caption2,
    color: colors.card,
    fontWeight: '700',
  },
  modelEmptyPill: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 10,
  },
  modelEmptyText: {
    ...typography.caption2,
    color: colors.textSecondary,
  },
  systemToggleChip: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 24,
    paddingHorizontal: 8,
  },
  systemToggleChipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  systemToggleChipPressed: {
    opacity: 0.82,
  },
  systemToggleChipText: {
    ...typography.caption2,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  systemToggleChipTextActive: {
    ...typography.caption2,
    color: colors.accent,
    fontWeight: '600',
  },
  errorRail: {
    borderColor: colors.danger,
    borderLeftColor: colors.danger,
    borderLeftWidth: 2,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorLabel: {
    ...typography.caption2,
    color: colors.danger,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  errorText: {
    ...typography.callout,
    color: colors.text,
  },
  threadList: {
    flex: 1,
  },
  threadContent: {
    gap: 10,
    paddingBottom: 8,
  },
  messageRow: {
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    gap: 3,
    maxWidth: '90%',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  messageRowAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderColor: colors.borderStrong,
  },
  messageRowSystem: {
    alignSelf: 'flex-start',
    backgroundColor: colors.warningSoft,
  },
  messageRowStreaming: {
    borderStyle: 'dashed',
  },
  messageRole: {
    ...typography.caption2,
    color: colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  messageRoleUser: {
    color: colors.accent,
  },
  messageRoleAssistant: {
    color: colors.textSecondary,
  },
  messageRoleSystem: {
    color: colors.warning,
  },
  messageText: {
    ...typography.callout,
    color: colors.text,
  },
  emptyState: {
    borderColor: colors.border,
    borderRadius: radii.input,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  emptyTitle: {
    ...typography.headline,
    color: colors.text,
  },
  emptyBody: {
    ...typography.callout,
    color: colors.textSecondary,
  },
  composer: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingTop: 12,
  },
  composerLabel: {
    ...typography.caption1,
    color: colors.textSecondary,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  composerInput: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.input,
    borderWidth: 1,
    color: colors.text,
    minHeight: 74,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  disabledReason: {
    ...typography.callout,
    color: colors.warning,
  },
  composerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.borderStrong,
    borderRadius: radii.button,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 86,
    paddingHorizontal: 10,
  },
  secondaryButtonDisabled: {
    opacity: 0.62,
  },
  secondaryButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
  secondaryButtonLabel: {
    ...typography.callout,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  secondaryButtonLabelDisabled: {
    ...typography.callout,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderColor: colors.accentEnd,
    borderRadius: radii.button,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.borderStrong,
    borderColor: colors.borderStrong,
    opacity: 1,
  },
  primaryButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  primaryButtonLabel: {
    ...typography.headline,
    color: colors.card,
    fontWeight: '700',
  },
  primaryButtonLabelDisabled: {
    ...typography.headline,
    color: colors.textTertiary,
    fontWeight: '700',
  },
});
