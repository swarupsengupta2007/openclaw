import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStoreProvider } from './app-store';
import { AppShell } from './app-shell';

export function RootApp() {
  return (
    <SafeAreaProvider>
      <AppStoreProvider>
        <AppShell />
        <StatusBar style="light" />
      </AppStoreProvider>
    </SafeAreaProvider>
  );
}
