import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ethers } from 'ethers';
import axios from 'axios';
import { RPC, IS_DEV, DEV_ADDRESSES } from '../constants/config';

// ─── Dev mock balances ────────────────────────────────────────────────────────
// Returned instantly when the dev account is active (IS_DEV + abandon mnemonic).
// Never compiled into production — IS_DEV is false in EAS release builds.
const DEV_BALANCES: Balances = {
  BTC:      0.05,    // ~$4 000 — enough to test THORChain swap minimums
  ETH:      0.5,
  SOL:      25,
  USDC_SOL: 100,
  USDT_SOL: 100,
  USDC_ETH: 100,
  USDT_ETH: 100,
};

export interface Balances {
  BTC: number;
  ETH: number;
  SOL: number;
  USDC_SOL: number;
  USDT_SOL: number;
  USDC_ETH: number;
  USDT_ETH: number;
}

export const ZERO_BALANCES: Balances = {
  BTC: 0,
  ETH: 0,
  SOL: 0,
  USDC_SOL: 0,
  USDT_SOL: 0,
  USDC_ETH: 0,
  USDT_ETH: 0,
};

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
];

const USDC_ETH = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const USDT_ETH = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDC_SOL_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_SOL_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const SPL_TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);

export async function fetchAllBalances(addresses: {
  btc: string;
  eth: string;
  sol: string;
}): Promise<Balances> {
  // In dev builds, return instant mock balances for the dev test wallet so
  // swap / send flows can be exercised without real on-chain funds.
  if (
    IS_DEV &&
    addresses.btc === DEV_ADDRESSES.btc &&
    addresses.eth === DEV_ADDRESSES.eth &&
    addresses.sol === DEV_ADDRESSES.sol
  ) {
    return { ...DEV_BALANCES };
  }

  const [btcRes, ethRes, solRes] = await Promise.allSettled([
    addresses.btc ? fetchBtcBalance(addresses.btc) : Promise.resolve(0),
    addresses.eth ? fetchEthBalances(addresses.eth) : Promise.resolve(null),
    addresses.sol ? fetchSolBalances(addresses.sol) : Promise.resolve(null),
  ]);

  const eth = ethRes.status === 'fulfilled' ? ethRes.value : null;
  const sol = solRes.status === 'fulfilled' ? solRes.value : null;

  return {
    BTC: btcRes.status === 'fulfilled' ? btcRes.value : 0,
    ETH: eth?.ETH ?? 0,
    USDC_ETH: eth?.USDC_ETH ?? 0,
    USDT_ETH: eth?.USDT_ETH ?? 0,
    SOL: sol?.SOL ?? 0,
    USDC_SOL: sol?.USDC_SOL ?? 0,
    USDT_SOL: sol?.USDT_SOL ?? 0,
  };
}

async function fetchBtcBalance(address: string): Promise<number> {
  const res = await axios.get(`${RPC.BITCOIN_API}/address/${address}`, {
    timeout: 10000,
  });
  const { funded_txo_sum, spent_txo_sum } = res.data.chain_stats as {
    funded_txo_sum: number;
    spent_txo_sum: number;
  };
  return (funded_txo_sum - spent_txo_sum) / 1e8;
}

async function fetchEthBalances(address: string): Promise<{
  ETH: number;
  USDC_ETH: number;
  USDT_ETH: number;
}> {
  const provider = new ethers.JsonRpcProvider(RPC.ETHEREUM);
  const [ethBal, usdcBal, usdtBal] = await Promise.all([
    provider.getBalance(address),
    getERC20Balance(provider, USDC_ETH, address, 6),
    getERC20Balance(provider, USDT_ETH, address, 6),
  ]);
  return {
    ETH: parseFloat(ethers.formatEther(ethBal)),
    USDC_ETH: usdcBal,
    USDT_ETH: usdtBal,
  };
}

async function getERC20Balance(
  provider: ethers.JsonRpcProvider,
  tokenAddress: string,
  wallet: string,
  decimals: number,
): Promise<number> {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const raw = (await contract.balanceOf(wallet)) as bigint;
  return parseFloat(ethers.formatUnits(raw, decimals));
}

async function fetchSolBalances(address: string): Promise<{
  SOL: number;
  USDC_SOL: number;
  USDT_SOL: number;
}> {
  const connection = new Connection(RPC.SOLANA, 'confirmed');
  const pubkey = new PublicKey(address);

  const [lamports, tokenAccounts] = await Promise.all([
    connection.getBalance(pubkey),
    connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: SPL_TOKEN_PROGRAM_ID,
    }),
  ]);

  let USDC_SOL = 0;
  let USDT_SOL = 0;

  for (const { account } of tokenAccounts.value) {
    const info = account.data.parsed.info as {
      mint: string;
      tokenAmount: { uiAmount: number | null };
    };
    if (info.mint === USDC_SOL_MINT) USDC_SOL = info.tokenAmount.uiAmount ?? 0;
    if (info.mint === USDT_SOL_MINT) USDT_SOL = info.tokenAmount.uiAmount ?? 0;
  }

  return { SOL: lamports / LAMPORTS_PER_SOL, USDC_SOL, USDT_SOL };
}
