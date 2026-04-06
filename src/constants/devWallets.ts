/**
 * DEV TESTING WALLETS
 * -------------------
 * 10 pre-configured wallet configs for rapid testing WITHOUT a dev server.
 * Each uses a real BIP-39 mnemonic, real bcrypt hashing, real secure storage.
 * The only shortcut is skipping the manual onboarding UI — the security is identical.
 *
 * ⚠️  REMOVE THIS FILE BEFORE PRODUCTION RELEASE  ⚠️
 * Also remove the <DevWalletBar /> from login.tsx and unlock.tsx.
 */

export interface DevWalletConfig {
  id: string;       // w1–w10
  mnemonic: string;  // 24-word BIP-39
  username: string;
  password: string;
  pin: string;
}

// 10 distinct BIP-39 test mnemonics (all-zeros style test vectors — no real funds)
export const DEV_WALLETS: DevWalletConfig[] = [
  {
    id: 'w1',
    mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
    username: 'alice',
    password: 'TestPass1!',
    pin: '111222',
  },
  {
    id: 'w2',
    mnemonic: 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote',
    username: 'bob',
    password: 'TestPass2!',
    pin: '222333',
  },
  {
    id: 'w3',
    mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    username: 'carol',
    password: 'TestPass3!',
    pin: '333444',
  },
  {
    id: 'w4',
    mnemonic: 'legal winner thank year wave sausage worth useful legal winner thank yellow',
    username: 'dave',
    password: 'TestPass4!',
    pin: '444555',
  },
  {
    id: 'w5',
    mnemonic: 'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
    username: 'eve',
    password: 'TestPass5!',
    pin: '555666',
  },
  {
    id: 'w6',
    mnemonic: 'void come effort suffer camp survey warrior heavy shoot primary clutch crush open amazing screen patrol group space point ten exist slush involve unfold',
    username: 'frank',
    password: 'TestPass6!',
    pin: '667788',
  },
  {
    id: 'w7',
    mnemonic: 'ozone drill grab fiber curtain grace pudding thank cruise elder eight picnic',
    username: 'grace',
    password: 'TestPass7!',
    pin: '778899',
  },
  {
    id: 'w8',
    mnemonic: 'hamster diagram private dutch cause delay private meat slide toddler razor book happy fancy gospel tennis maple dilemma loan word shrug inflict delay length',
    username: 'heidi',
    password: 'TestPass8!',
    pin: '889900',
  },
  {
    id: 'w9',
    mnemonic: 'scheme spot photo card baby mountain device kick cradle pact join borrow',
    username: 'ivan',
    password: 'TestPass9!',
    pin: '990011',
  },
  {
    id: 'w10',
    mnemonic: 'fat adult leopard camp old copy long mixed craft dream spread jungle quiz casual buzz text plastic defy hobby practice judge skill assist pretty',
    username: 'judy',
    password: 'TestPass10!',
    pin: '100211',
  },
];

// Default mock balances — $1000+ worth per token at typical market prices
export const DEV_MOCK_BALANCES = {
  BTC: 0.5,        // ~$30,000
  ETH: 3.0,        // ~$9,000
  SOL: 200,        // ~$25,000
  ADA: 3000,       // ~$1,200
  DOGE: 10000,     // ~$1,500
  XRP: 2000,       // ~$1,200
  DOT: 200,        // ~$1,400
  LINK: 100,       // ~$1,500
  POL: 3000,       // ~$1,500
  JUP: 2000,       // ~$1,600
  USDC_SOL: 2000,  // $2,000
  USDT_SOL: 2000,  // $2,000
  USDC_ETH: 2000,  // $2,000
  USDT_ETH: 2000,  // $2,000
};
