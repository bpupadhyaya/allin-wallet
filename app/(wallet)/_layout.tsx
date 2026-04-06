import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONT_WEIGHT } from '../../src/constants/theme';
import { useScaledTheme } from '../../src/hooks/useScaledTheme';

export default function WalletLayout() {
  const insets = useSafeAreaInsets();
  const { navSize, scaleFont, uiScale } = useScaledTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.bgSecondary,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 56 * uiScale + insets.bottom,
          paddingBottom: insets.bottom + 2,
          paddingTop: 2,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: scaleFont(9), fontWeight: FONT_WEIGHT.bold },
        tabBarIconStyle: { marginBottom: -2 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: scaleFont(16), color }}>⬡</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="swap"
        options={{
          title: 'Swap',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: scaleFont(16), color }}>⇄</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="receive"
        options={{
          title: 'Receive',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: scaleFont(16), color }}>↓</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="send"
        options={{
          title: 'Send',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: scaleFont(16), color }}>↑</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: scaleFont(16), color }}>🕐</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="walletconnect"
        options={{
          title: 'WC',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: scaleFont(16), color }}>🔗</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: scaleFont(16), color }}>⚙</Text>
          ),
        }}
      />
      <Tabs.Screen name="change-password" options={{ href: null }} />
      <Tabs.Screen name="change-pin" options={{ href: null }} />
      <Tabs.Screen name="coin-detail" options={{ href: null }} />
    </Tabs>
  );
}
