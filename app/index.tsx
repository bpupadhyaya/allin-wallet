import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { hasWallet, getWalletType, getWalletAddresses, getUsername } from '../src/services/storage';
import { useAppStore } from '../src/store/appStore';
import { COLORS } from '../src/constants/theme';

export default function Index() {
  const { setHasWallet, setAddresses } = useAppStore();

  useEffect(() => {
    async function bootstrap() {
      const walletExists = await hasWallet();
      if (walletExists) {
        const [type, addresses, username] = await Promise.all([
          getWalletType(),
          getWalletAddresses(),
          getUsername(),
        ]);
        setHasWallet(true, type!);
        if (addresses) setAddresses(addresses);
        router.replace('/(auth)/login');
      } else {
        router.replace('/(auth)/onboarding');
      }
    }
    bootstrap();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator color={COLORS.primary} size="large" />
    </View>
  );
}
