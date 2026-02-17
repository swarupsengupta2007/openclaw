import { StatusBar } from 'expo-status-bar';
import { HomeScreen } from '../features/home/home-screen';

export function RootApp() {
  return (
    <>
      <HomeScreen />
      <StatusBar style="light" />
    </>
  );
}
