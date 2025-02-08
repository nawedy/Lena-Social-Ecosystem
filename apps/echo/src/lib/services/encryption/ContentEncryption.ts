import { supabase } from '$lib/supabaseClient';
import { Buffer } from 'buffer';
import { webcrypto } from 'crypto';

interface EncryptionKeys {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}

interface EncryptedContent {
  ciphertext: string;
  iv: string;
  encryptedKey: string;
}

class ContentEncryptionService {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_ALGORITHM = 'RSA-OAEP';
  private static readonly KEY_LENGTH = 256;

  private async generateKeyPair(): Promise<EncryptionKeys> {
    const keyPair = await webcrypto.subtle.generateKey(
      {
        name: ContentEncryptionService.KEY_ALGORITHM,
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['encrypt', 'decrypt']
    );

    const publicKey = await webcrypto.subtle.exportKey(
      'jwk',
      keyPair.publicKey
    );

    const privateKey = await webcrypto.subtle.exportKey(
      'jwk',
      keyPair.privateKey
    );

    return { publicKey, privateKey };
  }

  private async generateContentKey(): Promise<CryptoKey> {
    return await webcrypto.subtle.generateKey(
      {
        name: ContentEncryptionService.ALGORITHM,
        length: ContentEncryptionService.KEY_LENGTH
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  private async importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return await webcrypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: ContentEncryptionService.KEY_ALGORITHM,
        hash: 'SHA-256'
      },
      false,
      ['encrypt']
    );
  }

  private async importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return await webcrypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: ContentEncryptionService.KEY_ALGORITHM,
        hash: 'SHA-256'
      },
      false,
      ['decrypt']
    );
  }

  private async importContentKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return await webcrypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: ContentEncryptionService.ALGORITHM
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encryptContent(
    content: string,
    recipientPublicKeys: JsonWebKey[]
  ): Promise<EncryptedContent> {
    try {
      // Generate a random content key
      const contentKey = await this.generateContentKey();
      const exportedContentKey = await webcrypto.subtle.exportKey('jwk', contentKey);

      // Generate a random IV
      const iv = webcrypto.getRandomValues(new Uint8Array(12));

      // Encrypt the content
      const encodedContent = new TextEncoder().encode(content);
      const encryptedContent = await webcrypto.subtle.encrypt(
        {
          name: ContentEncryptionService.ALGORITHM,
          iv
        },
        contentKey,
        encodedContent
      );

      // Encrypt the content key for each recipient
      const encryptedKeys = await Promise.all(
        recipientPublicKeys.map(async (publicKeyJwk) => {
          const publicKey = await this.importPublicKey(publicKeyJwk);
          const encryptedKey = await webcrypto.subtle.encrypt(
            {
              name: ContentEncryptionService.KEY_ALGORITHM
            },
            publicKey,
            Buffer.from(JSON.stringify(exportedContentKey))
          );
          return Buffer.from(encryptedKey).toString('base64');
        })
      );

      return {
        ciphertext: Buffer.from(encryptedContent).toString('base64'),
        iv: Buffer.from(iv).toString('base64'),
        encryptedKey: encryptedKeys.join(',')
      };
    } catch (error) {
      console.error('Error encrypting content:', error);
      throw error;
    }
  }

  async decryptContent(
    encryptedContent: EncryptedContent,
    privateKeyJwk: JsonWebKey
  ): Promise<string> {
    try {
      // Import the private key
      const privateKey = await this.importPrivateKey(privateKeyJwk);

      // Decrypt the content key
      const encryptedKeys = encryptedContent.encryptedKey.split(',');
      let contentKeyJwk: JsonWebKey | null = null;

      for (const encryptedKey of encryptedKeys) {
        try {
          const decryptedKeyBuffer = await webcrypto.subtle.decrypt(
            {
              name: ContentEncryptionService.KEY_ALGORITHM
            },
            privateKey,
            Buffer.from(encryptedKey, 'base64')
          );
          contentKeyJwk = JSON.parse(
            Buffer.from(decryptedKeyBuffer).toString()
          );
          break;
        } catch (e) {
          // Try next key if this one fails
          continue;
        }
      }

      if (!contentKeyJwk) {
        throw new Error('Unable to decrypt content key');
      }

      // Import the content key
      const contentKey = await this.importContentKey(contentKeyJwk);

      // Decrypt the content
      const decryptedContent = await webcrypto.subtle.decrypt(
        {
          name: ContentEncryptionService.ALGORITHM,
          iv: Buffer.from(encryptedContent.iv, 'base64')
        },
        contentKey,
        Buffer.from(encryptedContent.ciphertext, 'base64')
      );

      return new TextDecoder().decode(decryptedContent);
    } catch (error) {
      console.error('Error decrypting content:', error);
      throw error;
    }
  }

  async generateUserKeys(userId: string): Promise<void> {
    try {
      const keys = await this.generateKeyPair();

      await supabase
        .from('user_keys')
        .insert({
          user_id: userId,
          public_key: keys.publicKey,
          private_key: keys.privateKey,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error generating user keys:', error);
      throw error;
    }
  }

  async getUserPublicKey(userId: string): Promise<JsonWebKey> {
    try {
      const { data, error } = await supabase
        .from('user_keys')
        .select('public_key')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data.public_key;
    } catch (error) {
      console.error('Error getting user public key:', error);
      throw error;
    }
  }

  async getUserPrivateKey(userId: string): Promise<JsonWebKey> {
    try {
      const { data, error } = await supabase
        .from('user_keys')
        .select('private_key')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data.private_key;
    } catch (error) {
      console.error('Error getting user private key:', error);
      throw error;
    }
  }

  async rotateUserKeys(userId: string): Promise<void> {
    try {
      const keys = await this.generateKeyPair();

      await supabase
        .from('user_keys')
        .update({
          public_key: keys.publicKey,
          private_key: keys.privateKey,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    } catch (error) {
      console.error('Error rotating user keys:', error);
      throw error;
    }
  }

  async encryptFile(
    file: File,
    recipientPublicKeys: JsonWebKey[]
  ): Promise<{ encryptedFile: Blob; encryptedKey: string; iv: string }> {
    try {
      // Generate a random content key
      const contentKey = await this.generateContentKey();
      const exportedContentKey = await webcrypto.subtle.exportKey('jwk', contentKey);

      // Generate a random IV
      const iv = webcrypto.getRandomValues(new Uint8Array(12));

      // Read and encrypt the file
      const fileBuffer = await file.arrayBuffer();
      const encryptedContent = await webcrypto.subtle.encrypt(
        {
          name: ContentEncryptionService.ALGORITHM,
          iv
        },
        contentKey,
        fileBuffer
      );

      // Encrypt the content key for each recipient
      const encryptedKeys = await Promise.all(
        recipientPublicKeys.map(async (publicKeyJwk) => {
          const publicKey = await this.importPublicKey(publicKeyJwk);
          const encryptedKey = await webcrypto.subtle.encrypt(
            {
              name: ContentEncryptionService.KEY_ALGORITHM
            },
            publicKey,
            Buffer.from(JSON.stringify(exportedContentKey))
          );
          return Buffer.from(encryptedKey).toString('base64');
        })
      );

      return {
        encryptedFile: new Blob([encryptedContent], { type: 'application/octet-stream' }),
        encryptedKey: encryptedKeys.join(','),
        iv: Buffer.from(iv).toString('base64')
      };
    } catch (error) {
      console.error('Error encrypting file:', error);
      throw error;
    }
  }

  async decryptFile(
    encryptedFile: Blob,
    encryptedKey: string,
    iv: string,
    privateKeyJwk: JsonWebKey
  ): Promise<Blob> {
    try {
      // Import the private key
      const privateKey = await this.importPrivateKey(privateKeyJwk);

      // Decrypt the content key
      const encryptedKeys = encryptedKey.split(',');
      let contentKeyJwk: JsonWebKey | null = null;

      for (const key of encryptedKeys) {
        try {
          const decryptedKeyBuffer = await webcrypto.subtle.decrypt(
            {
              name: ContentEncryptionService.KEY_ALGORITHM
            },
            privateKey,
            Buffer.from(key, 'base64')
          );
          contentKeyJwk = JSON.parse(
            Buffer.from(decryptedKeyBuffer).toString()
          );
          break;
        } catch (e) {
          // Try next key if this one fails
          continue;
        }
      }

      if (!contentKeyJwk) {
        throw new Error('Unable to decrypt content key');
      }

      // Import the content key
      const contentKey = await this.importContentKey(contentKeyJwk);

      // Read and decrypt the file
      const fileBuffer = await encryptedFile.arrayBuffer();
      const decryptedContent = await webcrypto.subtle.decrypt(
        {
          name: ContentEncryptionService.ALGORITHM,
          iv: Buffer.from(iv, 'base64')
        },
        contentKey,
        fileBuffer
      );

      return new Blob([decryptedContent]);
    } catch (error) {
      console.error('Error decrypting file:', error);
      throw error;
    }
  }
}

export const contentEncryption = new ContentEncryptionService(); 