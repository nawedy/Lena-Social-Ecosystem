import { supabase } from '$lib/supabaseClient';
import { ethers } from 'ethers';

interface KeyRotationConfig {
  rotationInterval: number; // days
  backupEnabled: boolean;
  notifyOnRotation: boolean;
}

interface EncryptionKey {
  id: string;
  userId: string;
  keyType: string;
  publicKey: string;
  encryptedPrivateKey: string;
  version: number;
  createdAt: string;
  expiresAt: string | null;
  metadata: {
    algorithm: string;
    keySize: number;
    rotationId?: string;
    backupId?: string;
  };
}

class KeyRotationService {
  private defaultConfig: KeyRotationConfig = {
    rotationInterval: 30,
    backupEnabled: true,
    notifyOnRotation: true
  };

  async initializeKeys(userId: string): Promise<void> {
    try {
      // Check for existing keys
      const { data: existingKeys } = await supabase
        .from('encryption_keys')
        .select('*')
        .eq('user_id', userId);

      if (!existingKeys?.length) {
        // Generate initial key pairs
        await this.generateKeyPair(userId, 'content');
        await this.generateKeyPair(userId, 'messaging');
        await this.generateKeyPair(userId, 'backup');
      }
    } catch (error) {
      console.error('Failed to initialize keys:', error);
      throw new Error('Key initialization failed');
    }
  }

  private async generateKeyPair(
    userId: string,
    keyType: string,
    version: number = 1
  ): Promise<EncryptionKey> {
    // Generate new key pair
    const wallet = ethers.Wallet.createRandom();
    const masterKey = await this.generateMasterKey();

    // Encrypt private key with master key
    const encryptedPrivateKey = await this.encryptPrivateKey(
      wallet.privateKey,
      masterKey
    );

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.defaultConfig.rotationInterval);

    const keyData = {
      user_id: userId,
      key_type: keyType,
      public_key: wallet.publicKey,
      encrypted_private_key: encryptedPrivateKey,
      version,
      expires_at: expiresAt.toISOString(),
      metadata: {
        algorithm: 'ECDSA',
        keySize: 256,
        rotationId: ethers.utils.id(Date.now().toString())
      }
    };

    // Store key in database
    const { data, error } = await supabase
      .from('encryption_keys')
      .insert(keyData)
      .select()
      .single();

    if (error) throw error;
    return data as EncryptionKey;
  }

  async rotateKeys(userId: string): Promise<void> {
    try {
      // Get all active keys
      const { data: activeKeys, error: keysError } = await supabase
        .from('encryption_keys')
        .select('*')
        .eq('user_id', userId)
        .is('expires_at', null);

      if (keysError) throw keysError;

      // Generate new keys for each type
      for (const key of activeKeys || []) {
        // Create new key pair
        const newKey = await this.generateKeyPair(
          userId,
          key.key_type,
          key.version + 1
        );

        // Re-encrypt content with new key
        await this.reencryptContent(userId, key, newKey);

        // Mark old key as expired
        const { error: updateError } = await supabase
          .from('encryption_keys')
          .update({ expires_at: new Date().toISOString() })
          .eq('id', key.id);

        if (updateError) throw updateError;

        // Create backup if enabled
        if (this.defaultConfig.backupEnabled) {
          await this.backupKey(newKey);
        }
      }

      // Notify user if enabled
      if (this.defaultConfig.notifyOnRotation) {
        await this.notifyKeyRotation(userId);
      }
    } catch (error) {
      console.error('Failed to rotate keys:', error);
      throw new Error('Key rotation failed');
    }
  }

  private async reencryptContent(
    userId: string,
    oldKey: EncryptionKey,
    newKey: EncryptionKey
  ): Promise<void> {
    // Get all content encrypted with old key
    const { data: content } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .eq('encryption_key_id', oldKey.id);

    // Re-encrypt each piece of content
    for (const item of content || []) {
      const decrypted = await this.decryptWithKey(item.content, oldKey);
      const encrypted = await this.encryptWithKey(decrypted, newKey);

      await supabase
        .from('posts')
        .update({
          content: encrypted,
          encryption_key_id: newKey.id,
          metadata: {
            ...item.metadata,
            reencrypted: true,
            previousKeyId: oldKey.id
          }
        })
        .eq('id', item.id);
    }
  }

  private async backupKey(key: EncryptionKey): Promise<void> {
    // Generate backup key
    const backupKey = await this.generateKeyPair(key.userId, 'backup');

    // Encrypt key data with backup key
    const encryptedData = await this.encryptWithKey(
      JSON.stringify({
        privateKey: key.encryptedPrivateKey,
        metadata: key.metadata
      }),
      backupKey
    );

    // Store backup
    await supabase.from('key_backups').insert({
      user_id: key.userId,
      key_id: key.id,
      backup_key_id: backupKey.id,
      encrypted_data: encryptedData,
      metadata: {
        version: key.version,
        timestamp: new Date().toISOString()
      }
    });
  }

  private async generateMasterKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  private async encryptPrivateKey(
    privateKey: string,
    masterKey: CryptoKey
  ): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(privateKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      masterKey,
      data
    );

    return ethers.utils.hexlify(
      ethers.utils.concat([iv, new Uint8Array(encrypted)])
    );
  }

  private async encryptWithKey(
    data: string,
    key: EncryptionKey
  ): Promise<string> {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      ethers.utils.arrayify(key.publicKey),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      keyMaterial,
      encoded
    );

    return ethers.utils.hexlify(
      ethers.utils.concat([iv, new Uint8Array(encrypted)])
    );
  }

  private async decryptWithKey(
    encryptedData: string,
    key: EncryptionKey
  ): Promise<string> {
    const encrypted = ethers.utils.arrayify(encryptedData);
    const iv = encrypted.slice(0, 12);
    const data = encrypted.slice(12);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      ethers.utils.arrayify(key.encryptedPrivateKey),
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      keyMaterial,
      data
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  private async notifyKeyRotation(userId: string): Promise<void> {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'security',
      title: 'Security Keys Rotated',
      content: 'Your encryption keys have been automatically rotated for security.',
      metadata: {
        event: 'key_rotation',
        timestamp: new Date().toISOString()
      }
    });
  }

  // Schedule automatic key rotation
  async scheduleKeyRotation(userId: string): Promise<void> {
    const checkInterval = 24 * 60 * 60 * 1000; // 24 hours

    setInterval(async () => {
      try {
        const { data: keys } = await supabase
          .from('encryption_keys')
          .select('*')
          .eq('user_id', userId)
          .is('expires_at', null);

        for (const key of keys || []) {
          const expiresAt = new Date(key.created_at);
          expiresAt.setDate(
            expiresAt.getDate() + this.defaultConfig.rotationInterval
          );

          if (expiresAt <= new Date()) {
            await this.rotateKeys(userId);
            break;
          }
        }
      } catch (error) {
        console.error('Scheduled key rotation failed:', error);
      }
    }, checkInterval);
  }
}

export const keyRotationService = new KeyRotationService(); 