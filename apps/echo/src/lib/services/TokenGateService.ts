import { ethers } from 'ethers';
import { supabase } from '$lib/supabaseClient';
import type { Provider } from '@ethersproject/providers';
import { browser } from '$app/environment';

interface TokenGateConfig {
  contractAddress: string;
  chainId: number;
  minTokenBalance?: string;
  requiredTokenIds?: string[];
  metadata?: Record<string, any>;
}

interface TokenGateVerification {
  isValid: boolean;
  tokenBalance?: string;
  ownedTokenIds?: string[];
  error?: string;
}

// Token standard interfaces
const ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)'
];

const ERC1155_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)'
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

// Interface IDs
const INTERFACE_IDS = {
  ERC165: '0x01ffc9a7',
  ERC721: '0x80ac58cd',
  ERC1155: '0xd9b67a26',
  ERC20: '0x36372b07'
};

export class TokenGateService {
  private provider: Provider | null = null;
  private readonly defaultChainId = 1; // Ethereum Mainnet

  constructor() {
    if (browser) {
      this.initializeProvider();
    }
  }

  private async initializeProvider() {
    if (window.ethereum) {
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
    } else {
      // Fallback to a public provider (read-only)
      this.provider = ethers.getDefaultProvider();
    }
  }

  private async detectTokenStandard(contractAddress: string) {
    if (!this.provider) throw new Error('Provider not initialized');

    const contract = new ethers.Contract(
      contractAddress,
      ['function supportsInterface(bytes4 interfaceId) view returns (bool)'],
      this.provider
    );

    try {
      // Check ERC721
      const isERC721 = await contract.supportsInterface(INTERFACE_IDS.ERC721);
      if (isERC721) return 'ERC721';

      // Check ERC1155
      const isERC1155 = await contract.supportsInterface(INTERFACE_IDS.ERC1155);
      if (isERC1155) return 'ERC1155';

      // Check ERC20 (try to call decimals() function)
      try {
        const erc20Contract = new ethers.Contract(contractAddress, ERC20_ABI, this.provider);
        await erc20Contract.decimals();
        return 'ERC20';
      } catch {
        // Not an ERC20
      }

      throw new Error('Unsupported token standard');
    } catch (error) {
      // Contract might be ERC20 if supportsInterface is not available
      try {
        const erc20Contract = new ethers.Contract(contractAddress, ERC20_ABI, this.provider);
        await erc20Contract.decimals();
        return 'ERC20';
      } catch {
        throw new Error('Unsupported token standard');
      }
    }
  }

  private getContract(contractAddress: string, standard: string) {
    if (!this.provider) throw new Error('Provider not initialized');

    switch (standard) {
      case 'ERC721':
        return new ethers.Contract(contractAddress, ERC721_ABI, this.provider);
      case 'ERC1155':
        return new ethers.Contract(contractAddress, ERC1155_ABI, this.provider);
      case 'ERC20':
        return new ethers.Contract(contractAddress, ERC20_ABI, this.provider);
      default:
        throw new Error(`Unsupported token standard: ${standard}`);
    }
  }

  async createTokenGate(contentId: string, config: TokenGateConfig): Promise<void> {
    try {
      // Detect token standard if not specified
      const tokenStandard = config.metadata?.tokenStandard || 
        await this.detectTokenStandard(config.contractAddress);

      const { data: existingGate, error: fetchError } = await supabase
        .from('token_gates')
        .select()
        .eq('content_id', contentId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Failed to check existing token gate: ${fetchError.message}`);
      }

      if (existingGate) {
        throw new Error('Content already has a token gate');
      }

      const { error: insertError } = await supabase
        .from('token_gates')
        .insert([{
          content_id: contentId,
          contract_address: config.contractAddress,
          chain_id: config.chainId,
          min_token_balance: config.minTokenBalance,
          required_token_ids: config.requiredTokenIds,
          metadata: {
            ...config.metadata,
            tokenStandard,
            createdAt: new Date().toISOString()
          }
        }]);

      if (insertError) {
        throw new Error(`Failed to create token gate: ${insertError.message}`);
      }
    } catch (error) {
      console.error('Failed to create token gate:', error);
      throw error;
    }
  }

  async verifyAccess(contentId: string, userAddress: string): Promise<TokenGateVerification> {
    try {
      const { data: gate, error: fetchError } = await supabase
        .from('token_gates')
        .select()
        .eq('content_id', contentId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch token gate: ${fetchError.message}`);
      }

      if (!gate) {
        return { isValid: true }; // No token gate means open access
      }

      // Switch network if needed
      if (this.provider && 'request' in this.provider) {
        try {
          await (this.provider as any).request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${gate.chain_id.toString(16)}` }],
          });
        } catch (error) {
          console.error('Failed to switch network:', error);
          return { isValid: false, error: 'Failed to switch network' };
        }
      }

      const tokenStandard = gate.metadata?.tokenStandard || 
        await this.detectTokenStandard(gate.contract_address);
      const contract = this.getContract(gate.contract_address, tokenStandard);

      switch (tokenStandard) {
        case 'ERC721': {
          const balance = await contract.balanceOf(userAddress);

          if (gate.min_token_balance && balance.lt(gate.min_token_balance)) {
            return { isValid: false, tokenBalance: balance.toString() };
          }

          if (gate.required_token_ids && gate.required_token_ids.length > 0) {
            const ownedTokenIds: string[] = [];
            for (let i = 0; i < balance.toNumber(); i++) {
              const tokenId = await contract.tokenOfOwnerByIndex(userAddress, i);
              ownedTokenIds.push(tokenId.toString());
            }

            const hasRequiredTokens = gate.required_token_ids.some(id => 
              ownedTokenIds.includes(id)
            );

            if (!hasRequiredTokens) {
              return { isValid: false, ownedTokenIds };
            }
          }

          return { isValid: true, tokenBalance: balance.toString() };
        }

        case 'ERC1155': {
          if (gate.required_token_ids && gate.required_token_ids.length > 0) {
            const accounts = Array(gate.required_token_ids.length).fill(userAddress);
            const balances = await contract.balanceOfBatch(
              accounts,
              gate.required_token_ids
            );

            const hasRequiredTokens = balances.some(balance => balance.gt(0));
            if (!hasRequiredTokens) {
              return { isValid: false, tokenBalance: '0' };
            }
          } else {
            // For ERC1155, we need at least one token ID to check balance
            const balance = await contract.balanceOf(userAddress, 0);
            if (gate.min_token_balance && balance.lt(gate.min_token_balance)) {
              return { isValid: false, tokenBalance: balance.toString() };
            }
          }

          return { isValid: true };
        }

        case 'ERC20': {
          const balance = await contract.balanceOf(userAddress);
          const decimals = await contract.decimals();
          const adjustedBalance = ethers.utils.formatUnits(balance, decimals);

          if (gate.min_token_balance && 
              parseFloat(adjustedBalance) < parseFloat(gate.min_token_balance)) {
            return { isValid: false, tokenBalance: adjustedBalance };
          }

          return { isValid: true, tokenBalance: adjustedBalance };
        }

        default:
          throw new Error(`Unsupported token standard: ${tokenStandard}`);
      }
    } catch (error) {
      console.error('Token gate verification failed:', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async updateTokenGate(contentId: string, config: Partial<TokenGateConfig>): Promise<void> {
    try {
      // Detect token standard if contract address is updated
      let tokenStandard = config.metadata?.tokenStandard;
      if (config.contractAddress) {
        tokenStandard = await this.detectTokenStandard(config.contractAddress);
      }

      const { error } = await supabase
        .from('token_gates')
        .update({
          contract_address: config.contractAddress,
          chain_id: config.chainId,
          min_token_balance: config.minTokenBalance,
          required_token_ids: config.requiredTokenIds,
          metadata: config.metadata ? {
            ...config.metadata,
            tokenStandard,
            updatedAt: new Date().toISOString()
          } : undefined
        })
        .eq('content_id', contentId);

      if (error) {
        throw new Error(`Failed to update token gate: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to update token gate:', error);
      throw error;
    }
  }

  async removeTokenGate(contentId: string): Promise<void> {
    const { error } = await supabase
      .from('token_gates')
      .delete()
      .eq('content_id', contentId);

    if (error) {
      throw new Error(`Failed to remove token gate: ${error.message}`);
    }
  }
} 