import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

/**
 * Generate a BIP-39 mnemonic phrase.
 * @param strength 128 bits → 12 words; 256 bits → 24 words.
 */
export function generateMnemonic(strength: 128 | 256 = 256): string {
  return bip39.generateMnemonic(wordlist, strength);
}

export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic.trim().toLowerCase(), wordlist);
}

export function mnemonicToWords(mnemonic: string): string[] {
  return mnemonic.trim().toLowerCase().split(/\s+/);
}

export async function mnemonicToSeed(
  mnemonic: string,
  passphrase = '',
): Promise<Uint8Array> {
  return bip39.mnemonicToSeed(mnemonic.trim().toLowerCase(), passphrase);
}

/**
 * Normalise and validate user-typed mnemonic input.
 * Returns the cleaned mnemonic or null if invalid.
 */
export function sanitizeMnemonic(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!bip39.validateMnemonic(cleaned, wordlist)) return null;
  return cleaned;
}
