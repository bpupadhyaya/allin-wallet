import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAppStore } from '../src/store/appStore';
import { SESSION_TIMEOUT_MS, setTestnetMode } from '../src/constants/config';
import { getTestnetEnabled, getDisplayScales } from '../src/services/storage';

export default function RootLayout() {
  const { isAuthenticated, lock, setUseTestnet, setDisplayScales } = useAppStore();
  const bgTimestamp = useRef<number | null>(null);

  // ── Load testnet preference on startup ──────────────────────────────────
  useEffect(() => {
    getTestnetEnabled().then((enabled) => {
      setTestnetMode(enabled);
      setUseTestnet(enabled);
    });
    getDisplayScales().then((scales) => {
      if (scales) setDisplayScales(scales);
    });
  }, []);

  // ── Session timeout on app background ─────────────────────────────────────
  useEffect(() => {
    function handleAppStateChange(state: AppStateStatus) {
      if (state === 'background' || state === 'inactive') {
        bgTimestamp.current = Date.now();
      } else if (state === 'active') {
        if (bgTimestamp.current !== null && isAuthenticated) {
          const elapsed = Date.now() - bgTimestamp.current;
          if (elapsed > SESSION_TIMEOUT_MS) {
            lock();
            router.replace('/(auth)/unlock');
          }
        }
        bgTimestamp.current = null;
      }
    }

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [isAuthenticated, lock]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0A0A0F' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(wallet)" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
