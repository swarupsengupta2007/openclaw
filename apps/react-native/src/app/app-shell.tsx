import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatScreen } from '../features/chat/chat-screen';
import { ConnectScreen } from '../features/connect/connect-screen';
import { ScreenScreen } from '../features/screen/screen-screen';
import { SettingsScreen } from '../features/settings/settings-screen';
import { VoiceScreen } from '../features/voice/voice-screen';
import { OnboardingFlow } from '../features/onboarding/onboarding-flow';
import { useAppStore } from './app-store';
import { colors, gradients, radii } from './theme';

type TabId = 'connect' | 'chat' | 'voice' | 'screen' | 'settings';

const tabs: { id: TabId; label: string }[] = [
  { id: 'connect', label: 'Connect' },
  { id: 'chat', label: 'Chat' },
  { id: 'voice', label: 'Voice' },
  { id: 'screen', label: 'Screen' },
  { id: 'settings', label: 'Settings' },
];

const onboardingStorageKey = 'openclaw.mobile.onboarding.complete.v1';

export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>('connect');
  const [onboardingStatus, setOnboardingStatus] = useState<'loading' | 'required' | 'done'>('loading');
  const { state } = useAppStore();
  const insets = useSafeAreaInsets();
  const transition = useRef(new Animated.Value(1)).current;

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

  useEffect(() => {
    transition.setValue(0.6);
    Animated.spring(transition, {
      toValue: 1,
      speed: 15,
      bounciness: 7,
      useNativeDriver: true,
    }).start();
  }, [activeTab, transition]);

  const phaseLabel = state.phase.replace('_', ' ');
  const phaseStyle = statusStyle(state.phase);

  if (onboardingStatus === 'loading') {
    return (
      <View style={styles.safeArea}>
        <LinearGradient colors={gradients.appBackground} style={StyleSheet.absoluteFill} />
      </View>
    );
  }

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
      <LinearGradient colors={gradients.appBackground} style={StyleSheet.absoluteFill} />

      <SafeAreaView edges={['top']} style={styles.topSafeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brandEyebrow}>OPENCLAW NODE</Text>
            <Text style={styles.brand}>Mobile Control Deck</Text>
          </View>
          <View style={[styles.statusChip, phaseStyle]}>
            <Text style={styles.statusText}>{phaseLabel}</Text>
          </View>
        </View>
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
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
      >
        {renderTab(activeTab)}
      </Animated.View>

      <View style={[styles.tabWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}> 
        <LinearGradient colors={gradients.tabBar} style={styles.tabBar}>
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={styles.tabButton}>
                <Text style={active ? styles.tabLabelActive : styles.tabLabel}>{tab.label}</Text>
                {active ? <View style={styles.tabUnderline} /> : null}
              </Pressable>
            );
          })}
        </LinearGradient>
      </View>
    </View>
  );
}

function statusStyle(phase: string) {
  if (phase === 'connected') {
    return { backgroundColor: 'rgba(54,229,183,0.18)', borderColor: 'rgba(54,229,183,0.45)' };
  }
  if (phase === 'connecting') {
    return { backgroundColor: 'rgba(102,190,255,0.16)', borderColor: 'rgba(102,190,255,0.4)' };
  }
  if (phase === 'pairing_required' || phase === 'auth_required') {
    return { backgroundColor: 'rgba(247,193,93,0.18)', borderColor: 'rgba(247,193,93,0.42)' };
  }
  if (phase === 'error') {
    return { backgroundColor: 'rgba(255,107,130,0.18)', borderColor: 'rgba(255,107,130,0.42)' };
  }
  return { backgroundColor: 'rgba(159,178,215,0.14)', borderColor: 'rgba(159,178,215,0.32)' };
}

function renderTab(tabId: TabId) {
  switch (tabId) {
    case 'connect':
      return <ConnectScreen />;
    case 'chat':
      return <ChatScreen />;
    case 'voice':
      return <VoiceScreen />;
    case 'screen':
      return <ScreenScreen />;
    case 'settings':
      return <SettingsScreen />;
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
    backgroundColor: 'transparent',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  brandEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  brand: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
    marginTop: 2,
  },
  statusChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  statusText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'capitalize',
  },
  content: {
    flex: 1,
  },
  tabWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  tabBar: {
    borderColor: 'rgba(42,61,94,0.85)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 56,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tabUnderline: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    height: 3,
    marginTop: 5,
    width: 26,
  },
});
