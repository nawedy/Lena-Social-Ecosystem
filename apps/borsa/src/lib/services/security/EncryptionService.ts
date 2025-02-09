import { AES, enc } from 'crypto-js';
import { ethers } from 'ethers';

export class EncryptionService {
  private static readonly ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY;

  static async encryptPrivateKey(privateKey: string): Promise<string> {
    const encrypted = AES.encrypt(privateKey, this.ENCRYPTION_KEY).toString();
    return encrypted;
  }

  static async decryptPrivateKey(encryptedKey: string): Promise<string> {
    const decrypted = AES.decrypt(encryptedKey, this.ENCRYPTION_KEY).toString(enc.Utf8);
    if (!ethers.utils.isHexString(decrypted)) {
      throw new Error('Invalid decryption result');
    }
    return decrypted;
  }

  static async generateSignature(message: string, privateKey: string): Promise<string> {
    const wallet = new ethers.Wallet(privateKey);
    return wallet.signMessage(message);
  }

  static async verifySignature(message: string, signature: string, address: string): Promise<boolean> {
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  }

  static async hashMessage(message: string): Promise<string> {
    return ethers.utils.id(message);
  }
} 