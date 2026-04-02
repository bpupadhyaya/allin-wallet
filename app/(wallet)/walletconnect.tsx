/**
 * WalletConnect Screen
 * --------------------
 * • Shows active dApp sessions with a disconnect button.
 * • Opens a QR-code scanner to pair a new session via WC URI.
 * • Intercepts pending signing/transaction requests and shows an
 *   approval modal with the full request details.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CameraView, Camera } from 'expo-camera';
import { useAppStore } from '../../src/store/appStore';
import { wcService } from '../../src/services/walletConnect';
import { Button } from '../../src/components/Button';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../src/constants/theme';
import type { WcSession, WcRequest } from '../../src/store/appStore';

// ─── QR Scanner modal ───────────────────────────────────────────────────────

function QrModal({
  visible,
  onScan,
  onClose,
}: {
  visible: boolean;
  onScan: (uri: string) => void;
  onClose: () => void;
}) {
  const [hasPerm, setHasPerm] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!visible) { setScanned(false); return; }
    Camera.requestCameraPermissionsAsync().then(({ status }) =>
      setHasPerm(status === 'granted'),
    );
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={qrStyles.container}>
        <Text style={qrStyles.title}>Scan WalletConnect QR</Text>
        <Text style={qrStyles.subtitle}>
          Open a dApp in your browser and scan its WalletConnect QR code.
        </Text>

        {hasPerm === false && (
          <Text style={qrStyles.permText}>
            Camera permission denied. Please allow camera access in your device
            settings to use QR scanning.
          </Text>
        )}

        {hasPerm === true && (
          <View style={qrStyles.camBox}>
            <CameraView
              style={qrStyles.camera}
              facing="back"
              onBarcodeScanned={
                scanned
                  ? undefined
                  : ({ data }) => {
                      if (data.startsWith('wc:')) {
                        setScanned(true);
                        onScan(data);
                      }
                    }
              }
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            />
          </View>
        )}

        {hasPerm === null && <ActivityIndicator color={COLORS.primary} size="large" />}

        <Button title="Cancel" variant="outline" onPress={onClose} style={qrStyles.cancelBtn} />
      </View>
    </Modal>
  );
}

const qrStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: SPACING.lg,
    gap: SPACING.md,
    justifyContent: 'center',
  },
  title: { color: COLORS.text, fontSize: FONT_SIZE.xl, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },
  camBox: {
    height: 300,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  camera: { flex: 1 },
  permText: { color: '#FF4D4D', fontSize: FONT_SIZE.sm, textAlign: 'center' },
  cancelBtn: { marginTop: SPACING.sm },
});

// ─── Request approval modal ──────────────────────────────────────────────────

function RequestModal({
  req,
  onApprove,
  onReject,
}: {
  req: WcRequest;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isSign = req.method !== 'eth_sendTransaction';

  return (
    <Modal visible animationType="slide" transparent>
      <View style={reqStyles.overlay}>
        <View style={reqStyles.sheet}>
          {req.peerIcon ? (
            <Image source={{ uri: req.peerIcon }} style={reqStyles.peerIcon} />
          ) : (
            <Text style={reqStyles.peerIconPlaceholder}>🌐</Text>
          )}
          <Text style={reqStyles.peerName}>{req.peerName}</Text>
          <Text style={reqStyles.method}>{req.method}</Text>

          <View style={reqStyles.warningBox}>
            <Text style={reqStyles.warningText}>
              {isSign
                ? '⚠ You are about to sign a message. Only approve if you trust this dApp and initiated this request.'
                : '⚠ You are about to send a transaction. Verify the details carefully. This action cannot be undone.'}
            </Text>
          </View>

          <ScrollView style={reqStyles.paramsBox}>
            <Text style={reqStyles.paramsText}>
              {JSON.stringify(req.params, null, 2)}
            </Text>
          </ScrollView>

          <View style={reqStyles.btnRow}>
            <Button
              title="Reject"
              variant="danger"
              onPress={onReject}
              style={reqStyles.btnHalf}
            />
            <Button
              title="Approve"
              onPress={onApprove}
              style={reqStyles.btnHalf}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const reqStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.md,
    maxHeight: '90%',
  },
  peerIcon: { width: 56, height: 56, borderRadius: 28, alignSelf: 'center' },
  peerIconPlaceholder: { fontSize: 40, textAlign: 'center' },
  peerName: { color: COLORS.text, fontSize: FONT_SIZE.lg, fontWeight: '700', textAlign: 'center' },
  method: { color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '600', textAlign: 'center' },
  warningBox: {
    backgroundColor: '#2A1A0A',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#F5A623',
  },
  warningText: { color: '#F5A623', fontSize: FONT_SIZE.xs, lineHeight: 18 },
  paramsBox: {
    backgroundColor: COLORS.bgTertiary,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    maxHeight: 200,
  },
  paramsText: { color: COLORS.textSecondary, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  btnRow: { flexDirection: 'row', gap: SPACING.sm },
  btnHalf: { flex: 1 },
});

// ─── Session row ─────────────────────────────────────────────────────────────

function SessionRow({ session, onDisconnect }: { session: WcSession; onDisconnect: () => void }) {
  const date = new Date(session.connectedAt).toLocaleDateString();
  return (
    <View style={sessionStyles.row}>
      {session.peerIcon ? (
        <Image source={{ uri: session.peerIcon }} style={sessionStyles.icon} />
      ) : (
        <View style={sessionStyles.iconPlaceholder}>
          <Text style={{ fontSize: 18 }}>🌐</Text>
        </View>
      )}
      <View style={sessionStyles.info}>
        <Text style={sessionStyles.name}>{session.peerName}</Text>
        <Text style={sessionStyles.url} numberOfLines={1}>{session.peerUrl}</Text>
        <Text style={sessionStyles.date}>Connected {date}</Text>
      </View>
      <TouchableOpacity onPress={onDisconnect} style={sessionStyles.disconnectBtn}>
        <Text style={sessionStyles.disconnectText}>Disconnect</Text>
      </TouchableOpacity>
    </View>
  );
}

const sessionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  icon: { width: 40, height: 40, borderRadius: 20, flexShrink: 0 },
  iconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: { flex: 1, gap: 2 },
  name: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '700' },
  url: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  date: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  disconnectBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: '#FF4D4D',
  },
  disconnectText: { color: '#FF4D4D', fontSize: FONT_SIZE.xs, fontWeight: '600' },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function WalletConnectScreen() {
  const {
    wcSessions,
    wcPendingRequest,
    wcInitialized,
    addWcSession,
    removeWcSession,
    setWcPendingRequest,
    setWcInitialized,
    addresses,
  } = useAppStore();

  const [showQr, setShowQr] = useState(false);
  const [pairing, setPairing] = useState(false);

  // Register handlers once
  useFocusEffect(
    useCallback(() => {
      if (!wcInitialized && addresses?.eth) {
        wcService.init(addresses.eth).then(() => {
          wcService.setHandlers(
            (session) => addWcSession(session),
            (req) => setWcPendingRequest(req),
            (topic) => removeWcSession(topic),
          );
          setWcInitialized(true);
        });
      }
    }, [wcInitialized, addresses]),
  );

  const handleScan = async (uri: string) => {
    setShowQr(false);
    setPairing(true);
    try {
      await wcService.pair(uri);
    } catch (e: unknown) {
      Alert.alert('Pairing Failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setPairing(false);
    }
  };

  const handleDisconnect = async (topic: string) => {
    Alert.alert('Disconnect dApp', 'Are you sure you want to disconnect this session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await wcService.disconnectSession(topic);
          removeWcSession(topic);
        },
      },
    ]);
  };

  const handleApprove = async () => {
    if (!wcPendingRequest) return;
    try {
      await wcService.approveRequest(wcPendingRequest);
    } catch (e: unknown) {
      Alert.alert('Request Failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setWcPendingRequest(null);
    }
  };

  const handleReject = async () => {
    if (!wcPendingRequest) return;
    await wcService.rejectRequest(wcPendingRequest);
    setWcPendingRequest(null);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>WalletConnect</Text>
        <Button
          title={pairing ? 'Pairing…' : 'Scan QR'}
          onPress={() => setShowQr(true)}
          loading={pairing}
          style={styles.scanBtn}
        />
      </View>

      <Text style={styles.caption}>
        Connect to any WalletConnect-compatible dApp. Your private keys never
        leave your device — all signing happens on-chain locally.
      </Text>

      {/* Sessions list */}
      {wcSessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔗</Text>
          <Text style={styles.emptyText}>No active sessions</Text>
          <Text style={styles.emptyHint}>
            Tap "Scan QR" to pair with a dApp.
          </Text>
        </View>
      ) : (
        <FlatList
          data={wcSessions}
          keyExtractor={(s) => s.topic}
          renderItem={({ item }) => (
            <SessionRow
              session={item}
              onDisconnect={() => handleDisconnect(item.topic)}
            />
          )}
          contentContainerStyle={styles.list}
        />
      )}

      {/* QR scanner modal */}
      <QrModal
        visible={showQr}
        onScan={handleScan}
        onClose={() => setShowQr(false)}
      />

      {/* Pending request approval modal */}
      {wcPendingRequest && (
        <RequestModal
          req={wcPendingRequest}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: COLORS.text, fontSize: FONT_SIZE.xl, fontWeight: '800' },
  scanBtn: { alignSelf: 'flex-end' },
  caption: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    lineHeight: 18,
  },
  list: { gap: SPACING.sm },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: COLORS.text, fontSize: FONT_SIZE.lg, fontWeight: '700' },
  emptyHint: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
});
