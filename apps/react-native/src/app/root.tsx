import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStoreProvider } from './app-store';
import { AppShell } from './app-shell';

export function RootApp() {
  const [, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  if (fontError) {
    throw fontError;
  }

  return (
    <SafeAreaProvider>
      <AppStoreProvider>
        <AppShell />
        <StatusBar style="dark" />
      </AppStoreProvider>
    </SafeAreaProvider>
  );
}
