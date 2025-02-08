import { SignalProtocolStore } from '@privacyresearch/libsignal-protocol-typescript';
import { generateKeyPair, KeyPairType } from '@stablelib/x25519';
import { randomBytes } from '@stablelib/random';
import { box, secretbox } from '@stablelib/nacl';
import { encode as encodeBase64, decode as decodeBase64 } from '@stablelib/base64';

interface KeyBundle {
  identityKey: string;
  signedPreKey: {
    keyId: number;
    publicKey: string;
    signature: string;
  };
  oneTimePreKeys: Array<{
    keyId: number;
    publicKey: string;
  }>;
}

export class EncryptionService {
  private store: SignalProtocolStore;
  private identityKeyPair: KeyPairType;
  private registrationId: number;

  constructor() {
    this.store = new SignalProtocolStore();
    this.registrationId = Math.floor(Math.random() * 16384);
  }

  /**
   * Initialize encryption for a user
   */
  async initialize(): Promise<void> {
    // Generate identity key pair
    this.identityKeyPair = await generateKeyPair();
    await this.store.put('identityKey', this.identityKeyPair);

    // Generate signed prekey
    const preKey = await generateKeyPair();
    const signature = await this.signPreKey(preKey.publicKey);
    
    await this.store.storeSignedPreKey(1, {
      keyPair: preKey,
      signature
    });

    // Generate one-time prekeys
    for (let i = 0; i < 100; i++) {
      const oneTimePreKey = await generateKeyPair();
      await this.store.storePreKey(i, oneTimePreKey);
    }
  }

  /**
   * Get user's key bundle for establishing sessions
   */
  async getKeyBundle(): Promise<KeyBundle> {
    const signedPreKey = await this.store.loadSignedPreKey(1);
    const oneTimePreKeys = await Promise.all(
      Array.from({ length: 20 }, (_, i) => this.store.loadPreKey(i))
    );

    return {
      identityKey: encodeBase64(this.identityKeyPair.publicKey),
      signedPreKey: {
        keyId: 1,
        publicKey: encodeBase64(signedPreKey.keyPair.publicKey),
        signature: encodeBase64(signedPreKey.signature)
      },
      oneTimePreKeys: oneTimePreKeys.map((key, i) => ({
        keyId: i,
        publicKey: encodeBase64(key.publicKey)
      }))
    };
  }

  /**
   * Establish session with another user
   */
  async establishSession(theirBundle: KeyBundle): Promise<void> {
    const theirIdentityKey = decodeBase64(theirBundle.identityKey);
    const theirSignedPreKey = decodeBase64(theirBundle.signedPreKey.publicKey);
    const theirOneTimePreKey = decodeBase64(
      theirBundle.oneTimePreKeys[0].publicKey
    );

    // Verify signature
    const isValid = await this.verifySignature(
      theirIdentityKey,
      theirSignedPreKey,
      decodeBase64(theirBundle.signedPreKey.signature)
    );

    if (!isValid) {
      throw new Error('Invalid signature in key bundle');
    }

    // Create session
    const sessionBuilder = new SessionBuilder(
      this.store,
      this.getAddress(theirIdentityKey)
    );

    await sessionBuilder.processPreKey({
      identityKey: theirIdentityKey,
      registrationId: this.registrationId,
      signedPreKey: {
        keyId: theirBundle.signedPreKey.keyId,
        publicKey: theirSignedPreKey,
        signature: decodeBase64(theirBundle.signedPreKey.signature)
      },
      oneTimePreKey: {
        keyId: theirBundle.oneTimePreKeys[0].keyId,
        publicKey: theirOneTimePreKey
      }
    });
  }

  /**
   * Encrypt message for a recipient
   */
  async encryptMessage(
    recipientIdentityKey: string,
    message: string | Uint8Array
  ): Promise<{
    type: number;
    body: string;
    registrationId?: number;
  }> {
    const sessionCipher = new SessionCipher(
      this.store,
      this.getAddress(decodeBase64(recipientIdentityKey))
    );

    const messageBuffer = typeof message === 'string' 
      ? new TextEncoder().encode(message)
      : message;

    const ciphertext = await sessionCipher.encrypt(messageBuffer);
    return {
      type: ciphertext.type,
      body: encodeBase64(ciphertext.body),
      registrationId: ciphertext.registrationId
    };
  }

  /**
   * Decrypt message from a sender
   */
  async decryptMessage(
    senderIdentityKey: string,
    message: {
      type: number;
      body: string;
    }
  ): Promise<Uint8Array> {
    const sessionCipher = new SessionCipher(
      this.store,
      this.getAddress(decodeBase64(senderIdentityKey))
    );

    const plaintext = await sessionCipher.decrypt({
      type: message.type,
      body: decodeBase64(message.body)
    });

    return plaintext;
  }

  /**
   * Sign prekey with identity key
   */
  private async signPreKey(preKey: Uint8Array): Promise<Uint8Array> {
    const signature = await box(
      preKey,
      randomBytes(24),
      this.identityKeyPair.secretKey
    );
    return signature;
  }

  /**
   * Verify signature with identity key
   */
  private async verifySignature(
    identityKey: Uint8Array,
    preKey: Uint8Array,
    signature: Uint8Array
  ): Promise<boolean> {
    try {
      const verified = await box.open(
        signature,
        randomBytes(24),
        identityKey
      );
      return verified.every((b, i) => b === preKey[i]);
    } catch {
      return false;
    }
  }

  /**
   * Get signal protocol address
   */
  private getAddress(identityKey: Uint8Array): string {
    return encodeBase64(identityKey);
  }
}

// Create encryption service instance
export const encryption = new EncryptionService(); 