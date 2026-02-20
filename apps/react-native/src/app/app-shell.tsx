import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, MessageSquare, Mic, Monitor, Settings } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatScreen } from '../features/chat/chat-screen';
import { ConnectScreen } from '../features/connect/connect-screen';
import { ScreenScreen } from '../features/screen/screen-screen';
import { SettingsScreen } from '../features/settings/settings-screen';
import { VoiceScreen } from '../features/voice/voice-screen';
import { OnboardingFlow } from '../features/onboarding/onboarding-flow';
import { useAppStore } from './app-store';
import { colors, radii, shadows, typography } from './theme';

type TabId = 'connect' | 'chat' | 'voice' | 'screen' | 'settings';

const tabIcons = {
  connect: Link,
  chat: MessageSquare,
  voice: Mic,
  screen: Monitor,
  settings: Settings,
} as const;

const tabs: { id: TabId; label: string }[] = [
  { id: 'connect', label: 'Connect' },
  { id: 'chat', label: 'Chat' },
  { id: 'voice', label: 'Voice' },
  { id: 'screen', label: 'Screen' },
  { id: 'settings', label: 'Settings' },
];

const onboardingStorageKey = 'openclaw.mobile.onboarding.complete.v1';
const SCREEN_WIDTH = Dimensions.get('window').width;
const TAB_BAR_HORIZONTAL_MARGIN = 12;
const TAB_WIDTH = (SCREEN_WIDTH - TAB_BAR_HORIZONTAL_MARGIN * 2) / tabs.length;
const INDICATOR_INSET = 6;
const INDICATOR_WIDTH = TAB_WIDTH - INDICATOR_INSET * 2;

export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>('connect');
  const [onboardingStatus, setOnboardingStatus] = useState<'required' | 'done'>('required');
  const { state } = useAppStore();
  const insets = useSafeAreaInsets();

  const transition = useRef(new Animated.Value(1)).current;
  const tabIndicator = useRef(new Animated.Value(0)).current;
  const statusPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(onboardingStorageKey)
      .then((value) => {
        if (cancelled) {
          return;
        }
        setOnboardingStatus(value === '1' ? 'done' : 'required');
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error('Failed to read onboarding status', error);
        setOnboardingStatus('required');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pulsing status dot
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(statusPulse, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
        Animated.timing(statusPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [statusPulse]);

  // Tab content transition
  useEffect(() => {
    transition.setValue(0);
    Animated.spring(transition, {
      toValue: 1,
      speed: 18,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [activeTab, transition]);

  // Tab indicator slide
  useEffect(() => {
    const index = tabs.findIndex((t) => t.id === activeTab);
    Animated.spring(tabIndicator, {
      toValue: index * TAB_WIDTH + INDICATOR_INSET,
      speed: 20,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }, [activeTab, tabIndicator]);

  const phase = statusMeta(state.phase);
  const phaseLabel = state.phase.replace(/_/g, ' ');
  const resetOnboarding = async () => {
    try {
      await AsyncStorage.removeItem(onboardingStorageKey);
      setActiveTab('connect');
      setOnboardingStatus('required');
    } catch (error) {
      console.error('Failed to reset onboarding status', error);
    }
  };

  if (onboardingStatus === 'required') {
    return (
      <OnboardingFlow
        onFinish={() => {
          setOnboardingStatus('done');
          void AsyncStorage.setItem(onboardingStorageKey, '1').catch((error) => {
            console.error('Failed to persist onboarding status', error);
          });
        }}
      />
    );
  }

  return (
    <View style={styles.safeArea}>
      <SafeAreaView edges={['top']} style={styles.topSafeArea}>
        <View style={styles.header}>
          <Text style={styles.brand}>OpenClaw</Text>
          <View style={[styles.statusChip, { backgroundColor: phase.bgColor, borderColor: phase.borderColor }]}>
            <Animated.View style={[styles.statusDot, { backgroundColor: phase.dotColor, opacity: statusPulse }]} />
            <Text style={[styles.statusText, { color: phase.textColor }]}>{phaseLabel}</Text>
          </View>
        </View>
        <View style={styles.statusStrip} />
      </SafeAreaView>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: transition,
            transform: [
              {
                translateY: transition.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              },
            ],
          },
        ]}
      >
        {renderTab(activeTab, resetOnboarding)}
      </Animated.View>

      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Animated.View
          style={[
            styles.tabIndicator,
            { transform: [{ translateX: tabIndicator }] },
          ]}
        />
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          const Icon = tabIcons[tab.id];
          const iconColor = active ? colors.accent : colors.textTertiary;
          return (
            <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={styles.tabButton}>
              <Icon size={20} color={iconColor} strokeWidth={active ? 2.4 : 1.8} />
              <Text style={active ? styles.tabLabelActive : styles.tabLabel}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function statusMeta(phase: string) {
  if (phase === 'connected') {
    return { bgColor: colors.successSoft, dotColor: colors.success, textColor: colors.success, borderColor: '#CFEBD8' };
  }
  if (phase === 'connecting') {
    return { bgColor: colors.accentSoft, dotColor: colors.accent, textColor: colors.accent, borderColor: '#D5E2FA' };
  }
  if (phase === 'pairing_required' || phase === 'auth_required') {
    return { bgColor: colors.warningSoft, dotColor: colors.warning, textColor: colors.warning, borderColor: '#EED8B8' };
  }
  if (phase === 'error') {
    return { bgColor: colors.dangerSoft, dotColor: colors.danger, textColor: colors.danger, borderColor: '#F3C8C8' };
  }
  return { bgColor: colors.surface, dotColor: colors.textTertiary, textColor: colors.textSecondary, borderColor: colors.border };
}

function renderTab(tabId: TabId, onResetOnboarding: () => Promise<void>) {
  switch (tabId) {
    case 'connect':
      return <ConnectScreen onResetOnboarding={onResetOnboarding} />;
    case 'chat':
      return <ChatScreen />;
    case 'voice':
      return <VoiceScreen />;
    case 'screen':
      return <ScreenScreen />;
    case 'settings':
      return <SettingsScreen onResetOnboarding={onResetOnboarding} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  topSafeArea: {
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  brand: {
    ...typography.title2,
    color: colors.text,
    letterSpacing: -0.2,
  },
  statusChip: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: 5,
    minHeight: 28,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  statusText: {
    ...typography.caption1,
    letterSpacing: 0.1,
    textTransform: 'capitalize',
  },
  statusStrip: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    marginHorizontal: TAB_BAR_HORIZONTAL_MARGIN,
    marginBottom: 8,
    paddingTop: 7,
    paddingHorizontal: 2,
    ...shadows.sm,
  },
  tabIndicator: {
    backgroundColor: colors.accentSoft,
    borderColor: '#D3E0FA',
    borderRadius: 14,
    borderWidth: 1,
    height: 40,
    left: 0,
    position: 'absolute',
    top: 5,
    width: INDICATOR_WIDTH,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minHeight: 48,
    zIndex: 1,
  },
  tabLabel: {
    ...typography.caption2,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  tabLabelActive: {
    ...typography.caption2,
    color: colors.accent,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
