/**
 * WalletConnect v2 Service
 * ------------------------
 * Wraps @walletconnect/web3wallet for React Native.
 *
 * Supported methods (EIP-155 Ethereum):
 *   eth_sendTransaction   → sign + broadcast
 *   personal_sign         → sign arbitrary message
 *   eth_sign              → sign arbitrary message (legacy)
 *   eth_signTypedData_v4  → EIP-712 typed data signing
 *
 * Usage:
 *   await WalletConnectService.init(addresses.eth);
 *   await WalletConnectService.pair(uri);
 *
 * Project ID: register at https://cloud.walletconnect.com
 */

import { Core } from '@walletconnect/core';
import { Web3Wallet, type IWeb3Wallet } from '@walletconnect/web3wallet';
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils';
import { ethers } from 'ethers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMnemonic } from './storage';
import { getEthSigner } from '../crypto/wallets';
import { RPC, WC_PROJECT_ID } from '../constants/config';
import type { WcSession, WcRequest } from '../store/appStore';

type SessionApproveHandler = (session: WcSession) => void;
type RequestHandler = (req: WcRequest) => void;

class WalletConnectService {
  private wallet: IWeb3Wallet | null = null;
  private ethAddress = '';
  private onSessionApprove: SessionApproveHandler | null = null;
  private onRequest: RequestHandler | null = null;
  private onSessionDelete: ((topic: string) => void) | null = null;

  async init(ethAddress: string): Promise<void> {
    if (this.wallet) return; // Already initialized
    if (!WC_PROJECT_ID) {
      if (__DEV__) console.warn('[WC] No WC_PROJECT_ID set. WalletConnect disabled.');
      return;
    }

    this.ethAddress = ethAddress;

    const core = new Core({
      projectId: WC_PROJECT_ID,
      storage: {
        // Use AsyncStorage for React Native (map null → undefined for WC type)
        getItem: (key) => AsyncStorage.getItem(key).then((v) => v ?? undefined),
        setItem: (key, value) => AsyncStorage.setItem(key, value),
        removeItem: (key) => AsyncStorage.removeItem(key),
        getKeys: async () => {
          const keys = await AsyncStorage.getAllKeys();
          return [...keys];
        },
      },
    });

    this.wallet = await Web3Wallet.init({
      core,
      metadata: {
        name: 'AllIn Wallet',
        description: 'Non-custodial crypto wallet',
        url: 'https://allinwallet.app',
        icons: ['https://allinwallet.app/icon.png'],
      },
    });

    this.registerListeners();
  }

  private registerListeners() {
    if (!this.wallet) return;

    // Session proposal — dApp wants to connect
    this.wallet.on('session_proposal', async (proposal) => {
      try {
        const { id, params } = proposal;
        const chains = ['eip155:1']; // Ethereum mainnet

        const namespaces = buildApprovedNamespaces({
          proposal: params,
          supportedNamespaces: {
            eip155: {
              chains,
              methods: [
                'eth_sendTransaction',
                'personal_sign',
                'eth_sign',
                'eth_signTypedData_v4',
              ],
              events: ['accountsChanged', 'chainChanged'],
              accounts: chains.map((c) => `${c}:${this.ethAddress}`),
            },
          },
        });

        const session = await this.wallet!.approveSession({ id, namespaces });

        const peer = session.peer.metadata;
        const wcSession: WcSession = {
          topic: session.topic,
          peerName: peer.name,
          peerUrl: peer.url,
          peerIcon: peer.icons?.[0],
          chains,
          connectedAt: Date.now(),
        };
        this.onSessionApprove?.(wcSession);
      } catch (e) {
        if (__DEV__) console.error('[WC] session_proposal error', e);
      }
    });

    // Session request — dApp wants to sign/send
    this.wallet.on('session_request', async (event) => {
      const { topic, params, id } = event;
      const sessions = this.wallet!.getActiveSessions();
      const session = sessions[topic];
      const peer = session?.peer.metadata;

      const wcReq: WcRequest = {
        id,
        topic,
        method: params.request.method,
        params: params.request.params,
        peerName: peer?.name ?? 'Unknown dApp',
        peerIcon: peer?.icons?.[0],
      };
      this.onRequest?.(wcReq);
    });

    // Session deleted — dApp disconnected
    this.wallet.on('session_delete', ({ topic }) => {
      this.onSessionDelete?.(topic);
    });
  }

  setHandlers(
    onSessionApprove: SessionApproveHandler,
    onRequest: RequestHandler,
    onSessionDelete: (topic: string) => void,
  ) {
    this.onSessionApprove = onSessionApprove;
    this.onRequest = onRequest;
    this.onSessionDelete = onSessionDelete;
  }

  async pair(uri: string): Promise<void> {
    if (!this.wallet) throw new Error('WalletConnect not initialized');
    await this.wallet.core.pairing.pair({ uri });
  }

  getActiveSessions(): WcSession[] {
    if (!this.wallet) return [];
    return Object.values(this.wallet.getActiveSessions()).map((s) => ({
      topic: s.topic,
      peerName: s.peer.metadata.name,
      peerUrl: s.peer.metadata.url,
      peerIcon: s.peer.metadata.icons?.[0],
      chains: Object.keys(s.namespaces),
      connectedAt: s.expiry * 1000 - 7 * 24 * 60 * 60 * 1000, // Approx
    }));
  }

  async disconnectSession(topic: string): Promise<void> {
    if (!this.wallet) return;
    await this.wallet.disconnectSession({
      topic,
      reason: getSdkError('USER_DISCONNECTED'),
    });
  }

  // ── Request handlers ──────────────────────────────────────────────────────

  async approveRequest(req: WcRequest): Promise<void> {
    if (!this.wallet) throw new Error('WC not initialized');
    const mnemonic = await getMnemonic();
    if (!mnemonic) throw new Error('Wallet locked');

    const signer = await getEthSigner(mnemonic, RPC.ETHEREUM);
    let result: string;

    switch (req.method) {
      case 'eth_sendTransaction': {
        const txParams = (req.params as Array<{
          to?: string;
          from?: string;
          value?: string;
          data?: string;
          gas?: string;
          gasPrice?: string;
        }>)[0];
        const tx = await signer.sendTransaction({
          to: txParams.to,
          value: txParams.value ? BigInt(txParams.value) : undefined,
          data: txParams.data,
          gasLimit: txParams.gas ? BigInt(txParams.gas) : undefined,
        });
        result = tx.hash;
        break;
      }
      case 'personal_sign': {
        const [messageHex, _address] = req.params as [string, string];
        // personal_sign receives a hex-encoded message or plain UTF-8 string
        const message = messageHex.startsWith('0x')
          ? ethers.toUtf8String(messageHex)
          : messageHex;
        result = await signer.signMessage(message);
        break;
      }
      case 'eth_sign': {
        const [_address, messageHex] = req.params as [string, string];
        result = await signer.signMessage(ethers.getBytes(messageHex));
        break;
      }
      case 'eth_signTypedData_v4': {
        const [_address, typedDataRaw] = req.params as [string, string];
        const typedData = JSON.parse(typedDataRaw) as {
          domain: ethers.TypedDataDomain;
          types: Record<string, ethers.TypedDataField[]>;
          message: Record<string, unknown>;
          primaryType: string;
        };
        // Remove EIP712Domain from types to avoid ethers v6 conflict
        const { EIP712Domain, ...types } = typedData.types;
        result = await signer.signTypedData(
          typedData.domain,
          types,
          typedData.message,
        );
        break;
      }
      default:
        throw new Error(`Unsupported method: ${req.method}`);
    }

    await this.wallet.respondSessionRequest({
      topic: req.topic,
      response: {
        id: req.id,
        jsonrpc: '2.0',
        result,
      },
    });
  }

  async rejectRequest(req: WcRequest): Promise<void> {
    if (!this.wallet) return;
    await this.wallet.respondSessionRequest({
      topic: req.topic,
      response: {
        id: req.id,
        jsonrpc: '2.0',
        error: getSdkError('USER_REJECTED'),
      },
    });
  }

  isReady(): boolean {
    return this.wallet !== null;
  }
}

export const wcService = new WalletConnectService();
