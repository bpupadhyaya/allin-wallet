import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_BIOMETRIC_ENABLED = 'wallet_biometric_enabled_v1';

export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return isEnrolled;
}

export async function getBiometricType(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Fingerprint';
  }
  return 'Biometrics';
}

export async function authenticateWithBiometrics(promptMessage?: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: promptMessage ?? 'Unlock AllIn Wallet',
    cancelLabel: 'Use Password',
    disableDeviceFallback: false,
  });
  return result.success;
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY_BIOMETRIC_ENABLED, enabled ? '1' : '0');
}

export async function isBiometricEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEY_BIOMETRIC_ENABLED);
  return v === '1';
}
