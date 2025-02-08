import { ethers } from 'ethers';
import { env } from '$env/dynamic/public';
import { web3Provider } from '$lib/auth/store';
import type { TokenGateConfig } from '$lib/types/marketplace';

// ABI for ERC standards
const ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)'
];

const ERC1155_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])'
];

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

export class Web3Service {
  private provider: ethers.BrowserProvider | null = null;

  constructor() {
    web3Provider.subscribe((provider) => {
      this.provider = provider;
    });
  }

  /**
   * Get the current network
   */
  async getNetwork() {
    if (!this.provider) throw new Error('No Web3 provider available');
    return await this.provider.getNetwork();
  }

  /**
   * Switch to a specific network
   */
  async switchNetwork(chainId: number) {
    if (!window.ethereum) throw new Error('No Web3 provider available');

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }]
      });
    } catch (error: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (error.code === 4902) {
        const network = this.getNetworkConfig(chainId);
        if (!network) throw new Error('Unsupported network');

        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [network]
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Check if a user owns a specific token
   */
  async checkTokenOwnership(
    userAddress: string,
    contractAddress: string,
    tokenId?: string,
    tokenStandard: 'ERC721' | 'ERC1155' | 'ERC20' = 'ERC721'
  ): Promise<boolean> {
    if (!this.provider) throw new Error('No Web3 provider available');

    try {
      let contract;
      switch (tokenStandard) {
        case 'ERC721':
          contract = new ethers.Contract(contractAddress, ERC721_ABI, this.provider);
          if (tokenId) {
            const owner = await contract.ownerOf(tokenId);
            return owner.toLowerCase() === userAddress.toLowerCase();
          } else {
            const balance = await contract.balanceOf(userAddress);
            return balance > 0;
          }

        case 'ERC1155':
          contract = new ethers.Contract(contractAddress, ERC1155_ABI, this.provider);
          if (tokenId) {
            const balance = await contract.balanceOf(userAddress, tokenId);
            return balance > 0;
          } else {
            throw new Error('Token ID is required for ERC1155');
          }

        case 'ERC20':
          contract = new ethers.Contract(contractAddress, ERC20_ABI, this.provider);
          const balance = await contract.balanceOf(userAddress);
          const decimals = await contract.decimals();
          const minBalance = tokenId ? ethers.parseUnits(tokenId, decimals) : 0;
          return balance >= minBalance;

        default:
          throw new Error('Unsupported token standard');
      }
    } catch (error) {
      console.error('Failed to check token ownership:', error);
      return false;
    }
  }

  /**
   * Get token balance for a user
   */
  async getTokenBalance(
    userAddress: string,
    contractAddress: string,
    tokenId?: string,
    tokenStandard: 'ERC721' | 'ERC1155' | 'ERC20' = 'ERC721'
  ): Promise<string> {
    if (!this.provider) throw new Error('No Web3 provider available');

    try {
      let contract;
      switch (tokenStandard) {
        case 'ERC721':
          contract = new ethers.Contract(contractAddress, ERC721_ABI, this.provider);
          const balance = await contract.balanceOf(userAddress);
          return balance.toString();

        case 'ERC1155':
          contract = new ethers.Contract(contractAddress, ERC1155_ABI, this.provider);
          if (!tokenId) throw new Error('Token ID is required for ERC1155');
          const erc1155Balance = await contract.balanceOf(userAddress, tokenId);
          return erc1155Balance.toString();

        case 'ERC20':
          contract = new ethers.Contract(contractAddress, ERC20_ABI, this.provider);
          const erc20Balance = await contract.balanceOf(userAddress);
          const decimals = await contract.decimals();
          return ethers.formatUnits(erc20Balance, decimals);

        default:
          throw new Error('Unsupported token standard');
      }
    } catch (error) {
      console.error('Failed to get token balance:', error);
      throw error;
    }
  }

  /**
   * Get network configuration for a specific chain ID
   */
  private getNetworkConfig(chainId: number) {
    const networks = {
      1: {
        chainId: '0x1',
        chainName: 'Ethereum Mainnet',
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18
        },
        rpcUrls: [`https://mainnet.infura.io/v3/${env.VITE_INFURA_PROJECT_ID}`],
        blockExplorerUrls: ['https://etherscan.io']
      },
      5: {
        chainId: '0x5',
        chainName: 'Goerli Testnet',
        nativeCurrency: {
          name: 'Goerli Ether',
          symbol: 'ETH',
          decimals: 18
        },
        rpcUrls: [`https://goerli.infura.io/v3/${env.VITE_INFURA_PROJECT_ID}`],
        blockExplorerUrls: ['https://goerli.etherscan.io']
      },
      11155111: {
        chainId: '0xaa36a7',
        chainName: 'Sepolia Testnet',
        nativeCurrency: {
          name: 'Sepolia Ether',
          symbol: 'ETH',
          decimals: 18
        },
        rpcUrls: [`https://sepolia.infura.io/v3/${env.VITE_INFURA_PROJECT_ID}`],
        blockExplorerUrls: ['https://sepolia.etherscan.io']
      }
    };

    return networks[chainId as keyof typeof networks];
  }

  /**
   * Validate a token gate configuration
   */
  async validateTokenGateConfig(config: TokenGateConfig): Promise<boolean> {
    if (!this.provider) throw new Error('No Web3 provider available');

    try {
      // Check if the contract exists
      const code = await this.provider.getCode(config.contract_address);
      if (code === '0x') return false;

      // Check if the contract supports the specified standard
      let contract;
      switch (config.token_standard) {
        case 'ERC721':
          contract = new ethers.Contract(config.contract_address, ERC721_ABI, this.provider);
          await contract.supportsInterface('0x80ac58cd'); // ERC721 interface ID
          break;

        case 'ERC1155':
          contract = new ethers.Contract(config.contract_address, ERC1155_ABI, this.provider);
          await contract.supportsInterface('0xd9b67a26'); // ERC1155 interface ID
          break;

        case 'ERC20':
          contract = new ethers.Contract(config.contract_address, ERC20_ABI, this.provider);
          await contract.decimals(); // Check if it's a valid ERC20
          break;

        default:
          return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to validate token gate config:', error);
      return false;
    }
  }
}

export const web3Service = new Web3Service(); 