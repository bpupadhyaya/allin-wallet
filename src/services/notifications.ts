/**
 * Transaction Notification Service
 * ---------------------------------
 * Local push notifications for transaction confirmations.
 * No backend required — monitors tx status on-chain and fires
 * local notifications when confirmed or failed.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getExplorerTxUrl } from '../constants/config';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions. Call once on app startup.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Send a local notification for a confirmed transaction.
 */
export async function notifyTxConfirmed({
  txHash,
  type,
  chain,
  fromCoin,
  toCoin,
  fromAmount,
  toAmount,
}: {
  txHash: string;
  type: 'swap' | 'send';
  chain: string;
  fromCoin?: string;
  toCoin?: string;
  fromAmount?: number;
  toAmount?: number;
}): Promise<void> {
  const title = type === 'swap' ? 'Swap Confirmed' : 'Transaction Confirmed';
  const body = type === 'swap'
    ? `${fromAmount} ${fromCoin} → ${toAmount?.toFixed(6)} ${toCoin}`
    : `${fromAmount} ${fromCoin} sent successfully`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        txHash,
        explorerUrl: getExplorerTxUrl(chain, txHash),
      },
      sound: true,
    },
    trigger: null, // Immediate
  });
}

/**
 * Send a local notification for a failed transaction.
 */
export async function notifyTxFailed({
  txHash,
  type,
  fromCoin,
  reason,
}: {
  txHash: string;
  type: 'swap' | 'send';
  fromCoin?: string;
  reason?: string;
}): Promise<void> {
  const title = type === 'swap' ? 'Swap Failed' : 'Transaction Failed';
  const body = reason
    ? `${fromCoin} ${type} failed: ${reason}`
    : `Your ${fromCoin} ${type} could not be confirmed on-chain.`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { txHash },
      sound: true,
    },
    trigger: null,
  });
}

/**
 * Send a notification when wallet is locked due to session timeout.
 */
export async function notifyWalletLocked(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Wallet Locked',
      body: 'Your wallet has been locked due to inactivity.',
      sound: false,
    },
    trigger: null,
  });
}
