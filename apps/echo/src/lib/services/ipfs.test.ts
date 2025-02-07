import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ipfsService } from './ipfs';
import { mockSupabase } from '../../test/utils';
import { Web3Storage } from 'web3.storage';

// Mock Supabase client
vi.mock('$lib/supabaseClient', () => ({
  supabase: mockSupabase
}));

// Mock Web3.Storage
vi.mock('web3.storage', () => ({
  Web3Storage: vi.fn().mockImplementation(() => ({
    put: vi.fn().mockResolvedValue('test-cid'),
    get: vi.fn().mockResolvedValue({
      files: () => Promise.resolve([new File(['test'], 'test.txt')])
    }),
    pin: vi.fn().mockResolvedValue(undefined),
    unpin: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockResolvedValue({ pins: [] })
  }))
}));

// Mock crypto API
const mockCrypto = {
  subtle: {
    generateKey: vi.fn().mockResolvedValue('test-key'),
    exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    importKey: vi.fn().mockResolvedValue('test-key'),
    encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32))
  },
  getRandomValues: vi.fn().mockImplementation(arr => arr)
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto
});

describe('IPFS Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('upload', () => {
    it('should upload file to IPFS with encryption', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const result = await ipfsService.upload(file, { encrypt: true });

      expect(result.cid).toBe('test-cid');
      expect(result.encryptionKey).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('ipfs_content');
      expect(mockSupabase.from().insert).toHaveBeenCalled();
    });

    it('should upload file without encryption', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const result = await ipfsService.upload(file, { encrypt: false });

      expect(result.cid).toBe('test-cid');
      expect(result.encryptionKey).toBeUndefined();
    });

    it('should handle upload errors', async () => {
      const error = new Error('Upload failed');
      const web3StorageMock = Web3Storage as jest.Mock;
      web3StorageMock.mockImplementationOnce(() => ({
        put: vi.fn().mockRejectedValue(error)
      }));

      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      await expect(ipfsService.upload(file)).rejects.toThrow('Failed to upload content to IPFS');
    });
  });

  describe('get', () => {
    it('should retrieve encrypted content', async () => {
      const cid = 'test-cid';
      const encryptionKey = 'test-key';
      const result = await ipfsService.get(cid, encryptionKey);

      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();
    });

    it('should retrieve unencrypted content', async () => {
      const cid = 'test-cid';
      const result = await ipfsService.get(cid);

      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(mockCrypto.subtle.decrypt).not.toHaveBeenCalled();
    });

    it('should handle retrieval errors', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Fetch failed'));
      const cid = 'test-cid';

      await expect(ipfsService.get(cid)).rejects.toThrow('Failed to get content from IPFS');
    });
  });

  describe('pin', () => {
    it('should pin content', async () => {
      const cid = 'test-cid';
      await ipfsService.pin(cid);

      const web3StorageMock = Web3Storage as jest.Mock;
      const instance = web3StorageMock.mock.results[0].value;
      expect(instance.pin).toHaveBeenCalledWith(cid);
    });

    it('should handle pinning errors', async () => {
      const web3StorageMock = Web3Storage as jest.Mock;
      web3StorageMock.mockImplementationOnce(() => ({
        pin: vi.fn().mockRejectedValue(new Error('Pinning failed'))
      }));

      const cid = 'test-cid';
      await expect(ipfsService.pin(cid)).rejects.toThrow('Failed to pin content');
    });
  });

  describe('unpin', () => {
    it('should unpin content', async () => {
      const cid = 'test-cid';
      await ipfsService.unpin(cid);

      const web3StorageMock = Web3Storage as jest.Mock;
      const instance = web3StorageMock.mock.results[0].value;
      expect(instance.unpin).toHaveBeenCalledWith(cid);
    });

    it('should handle unpinning errors', async () => {
      const web3StorageMock = Web3Storage as jest.Mock;
      web3StorageMock.mockImplementationOnce(() => ({
        unpin: vi.fn().mockRejectedValue(new Error('Unpinning failed'))
      }));

      const cid = 'test-cid';
      await expect(ipfsService.unpin(cid)).rejects.toThrow('Failed to unpin content');
    });
  });

  describe('status', () => {
    it('should get content status', async () => {
      const cid = 'test-cid';
      const status = await ipfsService.status(cid);

      expect(status).toEqual({ pins: [] });
      const web3StorageMock = Web3Storage as jest.Mock;
      const instance = web3StorageMock.mock.results[0].value;
      expect(instance.status).toHaveBeenCalledWith(cid);
    });

    it('should handle status errors', async () => {
      const web3StorageMock = Web3Storage as jest.Mock;
      web3StorageMock.mockImplementationOnce(() => ({
        status: vi.fn().mockRejectedValue(new Error('Status check failed'))
      }));

      const cid = 'test-cid';
      await expect(ipfsService.status(cid)).rejects.toThrow('Failed to get content status');
    });
  });

  describe('encryption utilities', () => {
    it('should generate encryption key', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const result = await ipfsService.upload(file, { encrypt: true });

      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      expect(result.encryptionKey).toBeDefined();
    });

    it('should encrypt content', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      await ipfsService.upload(file, { encrypt: true });

      expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();
      expect(mockCrypto.getRandomValues).toHaveBeenCalled();
    });

    it('should decrypt content', async () => {
      const cid = 'test-cid';
      const encryptionKey = 'test-key';
      await ipfsService.get(cid, encryptionKey);

      expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();
    });
  });
}); 