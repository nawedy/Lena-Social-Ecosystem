import { Web3Storage } from 'web3.storage';

export class StorageService {
  private client: Web3Storage;
  private ipfsGateway: string;

  constructor(token: string, ipfsGateway: string) {
    this.client = new Web3Storage({ token });
    this.ipfsGateway = ipfsGateway;
  }

  async uploadFile(
    file: File, 
    onProgress?: (progress: number) => void
  ): Promise<string> {
    // Create a File object with proper name and type
    const fileToUpload = new File([file], file.name, { type: file.type });

    // Upload to Web3.Storage
    const cid = await this.client.put([fileToUpload], {
      name: file.name,
      onRootCidReady: () => {
        onProgress?.(0);
      },
      onStoredChunk: (size) => {
        const percentage = (size / file.size) * 100;
        onProgress?.(Math.min(percentage, 100));
      }
    });

    // Return the IPFS URL using the configured gateway
    return `${this.ipfsGateway}/ipfs/${cid}/${file.name}`;
  }

  async uploadFiles(
    files: File[], 
    onProgress?: (progress: number) => void
  ): Promise<string[]> {
    // Create File objects with proper names and types
    const filesToUpload = files.map(file => 
      new File([file], file.name, { type: file.type })
    );

    // Upload to Web3.Storage
    const cid = await this.client.put(filesToUpload, {
      onRootCidReady: () => {
        onProgress?.(0);
      },
      onStoredChunk: (size) => {
        const totalSize = files.reduce((acc, file) => acc + file.size, 0);
        const percentage = (size / totalSize) * 100;
        onProgress?.(Math.min(percentage, 100));
      }
    });

    // Return IPFS URLs for all files using the configured gateway
    return files.map(file => 
      `${this.ipfsGateway}/ipfs/${cid}/${file.name}`
    );
  }

  async uploadDirectory(
    files: File[], 
    directoryName: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    // Create File objects with proper names and types
    const filesToUpload = files.map(file => 
      new File([file], `${directoryName}/${file.name}`, { type: file.type })
    );

    // Upload to Web3.Storage
    const cid = await this.client.put(filesToUpload, {
      name: directoryName,
      onRootCidReady: () => {
        onProgress?.(0);
      },
      onStoredChunk: (size) => {
        const totalSize = files.reduce((acc, file) => acc + file.size, 0);
        const percentage = (size / totalSize) * 100;
        onProgress?.(Math.min(percentage, 100));
      }
    });

    // Return the IPFS URL for the directory using the configured gateway
    return `${this.ipfsGateway}/ipfs/${cid}/${directoryName}`;
  }
} 