import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ethers } from 'ethers';
import axios from 'axios';
import { getRpc, IS_DEV, getDevAddresses } from '../constants/config';
import { COINS, getContractAddress } from '../constants/coins';

// ─── Dev mock balances ────────────────────────────────────────────────────────
// Returned instantly when the dev account is active (IS_DEV + abandon mnemonic).
// Never compiled into production — IS_DEV is false in EAS release builds.
const DEV_BALANCES: Balances = {
  BTC:      0.05,
  ETH:      0.5,
  SOL:      25,
  ADA:      500,
  DOGE:     1000,
  XRP:      200,
  DOT:      50,
  LINK:     10,
  POL:      500,
  JUP:      50,
  USDC_SOL: 100,
  USDT_SOL: 100,
  USDC_ETH: 100,
  USDT_ETH: 100,
};

export interface Balances {
  BTC: number;
  ETH: number;
  SOL: number;
  ADA: number;
  DOGE: number;
  XRP: number;
  DOT: number;
  LINK: number;
  POL: number;
  JUP: number;
  USDC_SOL: number;
  USDT_SOL: number;
  USDC_ETH: number;
  USDT_ETH: number;
}

export const ZERO_BALANCES: Balances = {
  BTC: 0, ETH: 0, SOL: 0,
  ADA: 0, DOGE: 0, XRP: 0, DOT: 0, LINK: 0, POL: 0, JUP: 0,
  USDC_SOL: 0, USDT_SOL: 0, USDC_ETH: 0, USDT_ETH: 0,
};

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
];

function getTokenAddresses() {
  return {
    USDC_ETH: getContractAddress(COINS.USDC_ETH)!,
    USDT_ETH: getContractAddress(COINS.USDT_ETH)!,
    USDC_SOL_MINT: getContractAddress(COINS.USDC_SOL)!,
    USDT_SOL_MINT: getContractAddress(COINS.USDT_SOL)!,
    JUP_MINT: getContractAddress(COINS.JUP)!,
  };
}
const SPL_TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);

export async function fetchAllBalances(addresses: {
  btc: string;
  eth: string;
  sol: string;
  ada: string;
  doge: string;
  xrp: string;
  dot: string;
  pol: string;
}): Promise<Balances> {
  const devAddrs = getDevAddresses();
  if (
    IS_DEV &&
    addresses.btc === devAddrs.btc &&
    addresses.eth === devAddrs.eth &&
    addresses.sol === devAddrs.sol
  ) {
    return { ...DEV_BALANCES };
  }

  const [btcRes, ethRes, solRes, adaRes, dogeRes, xrpRes, dotRes, polRes] = await Promise.allSettled([
    addresses.btc ? fetchBtcBalance(addresses.btc) : Promise.resolve(0),
    addresses.eth ? fetchEthBalances(addresses.eth) : Promise.resolve(null),
    addresses.sol ? fetchSolBalances(addresses.sol) : Promise.resolve(null),
    addresses.ada ? fetchAdaBalance(addresses.ada) : Promise.resolve(0),
    addresses.doge ? fetchDogeBalance(addresses.doge) : Promise.resolve(0),
    addresses.xrp ? fetchXrpBalance(addresses.xrp) : Promise.resolve(0),
    addresses.dot ? fetchDotBalance(addresses.dot) : Promise.resolve(0),
    addresses.pol ? fetchPolBalances(addresses.pol) : Promise.resolve(null),
  ]);

  const eth = ethRes.status === 'fulfilled' ? ethRes.value : null;
  const sol = solRes.status === 'fulfilled' ? solRes.value : null;
  const pol = polRes.status === 'fulfilled' ? polRes.value : null;

  return {
    BTC: btcRes.status === 'fulfilled' ? btcRes.value : 0,
    ETH: eth?.ETH ?? 0,
    LINK: eth?.LINK ?? 0,
    USDC_ETH: eth?.USDC_ETH ?? 0,
    USDT_ETH: eth?.USDT_ETH ?? 0,
    SOL: sol?.SOL ?? 0,
    JUP: sol?.JUP ?? 0,
    USDC_SOL: sol?.USDC_SOL ?? 0,
    USDT_SOL: sol?.USDT_SOL ?? 0,
    ADA: adaRes.status === 'fulfilled' ? adaRes.value : 0,
    DOGE: dogeRes.status === 'fulfilled' ? dogeRes.value : 0,
    XRP: xrpRes.status === 'fulfilled' ? xrpRes.value : 0,
    DOT: dotRes.status === 'fulfilled' ? dotRes.value : 0,
    POL: pol?.POL ?? 0,
  };
}

async function fetchBtcBalance(address: string): Promise<number> {
  const res = await axios.get(`${getRpc().BITCOIN_API}/address/${address}`, {
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
  LINK: number;
  USDC_ETH: number;
  USDT_ETH: number;
}> {
  const tokens = getTokenAddresses();
  const provider = new ethers.JsonRpcProvider(getRpc().ETHEREUM);
  const [ethBal, linkBal, usdcBal, usdtBal] = await Promise.all([
    provider.getBalance(address),
    getERC20Balance(provider, getContractAddress(COINS.LINK)!, address, 18),
    getERC20Balance(provider, tokens.USDC_ETH, address, 6),
    getERC20Balance(provider, tokens.USDT_ETH, address, 6),
  ]);
  return {
    ETH: parseFloat(ethers.formatEther(ethBal)),
    LINK: linkBal,
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
  JUP: number;
}> {
  const connection = new Connection(getRpc().SOLANA, 'confirmed');
  const pubkey = new PublicKey(address);

  const [lamports, tokenAccounts] = await Promise.all([
    connection.getBalance(pubkey),
    connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: SPL_TOKEN_PROGRAM_ID,
    }),
  ]);

  let USDC_SOL = 0;
  let USDT_SOL = 0;
  let JUP = 0;

  for (const { account } of tokenAccounts.value) {
    const info = account.data.parsed.info as {
      mint: string;
      tokenAmount: { uiAmount: number | null };
    };
    const tokens = getTokenAddresses();
    if (info.mint === tokens.USDC_SOL_MINT) USDC_SOL = info.tokenAmount.uiAmount ?? 0;
    if (info.mint === tokens.USDT_SOL_MINT) USDT_SOL = info.tokenAmount.uiAmount ?? 0;
    if (info.mint === tokens.JUP_MINT) JUP = info.tokenAmount.uiAmount ?? 0;
  }

  return { SOL: lamports / LAMPORTS_PER_SOL, USDC_SOL, USDT_SOL, JUP };
}

// ─── Cardano ──────────────────────────────────────────────────────────────
async function fetchAdaBalance(address: string): Promise<number> {
  try {
    const { data } = await axios.get(
      `${getRpc().CARDANO_API}/addresses/${address}`,
      { timeout: 10000, headers: { project_id: process.env.EXPO_PUBLIC_BLOCKFROST_KEY || '' } },
    );
    // Blockfrost returns lovelace as string in amount array
    const lovelace = data.amount?.find((a: any) => a.unit === 'lovelace');
    return lovelace ? parseInt(lovelace.quantity) / 1e6 : 0;
  } catch {
    return 0;
  }
}

// ─── Dogecoin ─────────────────────────────────────────────────────────────
async function fetchDogeBalance(address: string): Promise<number> {
  try {
    const { data } = await axios.get(
      `${getRpc().DOGECOIN_API}/address/balance/${address}`,
      { timeout: 10000 },
    );
    return parseFloat(data.balance ?? '0');
  } catch {
    return 0;
  }
}

// ─── XRP ──────────────────────────────────────────────────────────────────
async function fetchXrpBalance(address: string): Promise<number> {
  try {
    const { data } = await axios.post(getRpc().XRP_RPC, {
      method: 'account_info',
      params: [{ account: address, ledger_index: 'validated' }],
    }, { timeout: 10000 });
    const drops = data.result?.account_data?.Balance;
    return drops ? parseInt(drops) / 1e6 : 0;
  } catch {
    return 0;
  }
}

// ─── Polkadot ─────────────────────────────────────────────────────────────
async function fetchDotBalance(address: string): Promise<number> {
  try {
    // Use Subscan API for simplicity
    const { data } = await axios.post(
      'https://polkadot.api.subscan.io/api/v2/scan/search',
      { key: address },
      { timeout: 10000, headers: { 'Content-Type': 'application/json' } },
    );
    const balance = data.data?.account?.balance;
    return balance ? parseFloat(balance) : 0;
  } catch {
    return 0;
  }
}

// ─── Polygon ──────────────────────────────────────────────────────────────
async function fetchPolBalances(address: string): Promise<{ POL: number }> {
  try {
    const provider = new ethers.JsonRpcProvider(getRpc().POLYGON_RPC);
    const bal = await provider.getBalance(address);
    return { POL: parseFloat(ethers.formatEther(bal)) };
  } catch {
    return { POL: 0 };
  }
}
