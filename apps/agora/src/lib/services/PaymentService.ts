import { ethers } from 'ethers';
import { supabase } from '$lib/supabaseClient';

// Smart contract ABIs
const ESCROW_ABI = [
  'function createEscrow(address seller, uint256 amount) payable returns (uint256)',
  'function releaseEscrow(uint256 escrowId)',
  'function refundEscrow(uint256 escrowId)',
  'function disputeEscrow(uint256 escrowId)',
  'function resolveDispute(uint256 escrowId, bool releaseFunds)',
  'event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount)',
  'event EscrowReleased(uint256 indexed escrowId)',
  'event EscrowRefunded(uint256 indexed escrowId)',
  'event EscrowDisputed(uint256 indexed escrowId)',
  'event DisputeResolved(uint256 indexed escrowId, bool releasedToSeller)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address recipient, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  escrowContract: string;
  tokens: {
    [key: string]: {
      address: string;
      decimals: number;
    };
  };
}

const NETWORKS: { [key: string]: NetworkConfig } = {
  eth: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://mainnet.infura.io/v3/YOUR_INFURA_ID',
    escrowContract: '0x...',
    tokens: {
      USDC: { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6 },
      DAI: { address: '0x6b175474e89094c44da98b954eedeac495271d0f', decimals: 18 }
    }
  },
  matic: {
    chainId: 137,
    name: 'Polygon Mainnet',
    rpcUrl: 'https://polygon-rpc.com',
    escrowContract: '0x...',
    tokens: {
      USDC: { address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', decimals: 6 },
      DAI: { address: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063', decimals: 18 }
    }
  }
};

export class PaymentService {
  private provider: ethers.providers.Web3Provider | null = null;
  private escrowContract: ethers.Contract | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.ethereum) {
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
    }
  }

  async switchNetwork(network: string) {
    if (!this.provider) throw new Error('No Web3 provider available');

    const config = NETWORKS[network];
    if (!config) throw new Error('Unsupported network');

    try {
      await this.provider.send('wallet_switchEthereumChain', [
        { chainId: `0x${config.chainId.toString(16)}` }
      ]);
    } catch (error: any) {
      if (error.code === 4902) {
        await this.provider.send('wallet_addEthereumChain', [{
          chainId: `0x${config.chainId.toString(16)}`,
          chainName: config.name,
          nativeCurrency: {
            name: network.toUpperCase(),
            symbol: network.toUpperCase(),
            decimals: 18
          },
          rpcUrls: [config.rpcUrl]
        }]);
      } else {
        throw error;
      }
    }
  }

  async createEscrow(sellerId: string, amount: number, currency: string): Promise<string> {
    if (!this.provider) throw new Error('No Web3 provider available');

    const signer = this.provider.getSigner();
    const network = await this.provider.getNetwork();
    const networkConfig = Object.values(NETWORKS).find(n => n.chainId === network.chainId);

    if (!networkConfig) throw new Error('Unsupported network');

    // Get seller's wallet address
    const { data: seller } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('id', sellerId)
      .single();

    if (!seller?.wallet_address) throw new Error('Seller wallet not found');

    // Initialize escrow contract
    this.escrowContract = new ethers.Contract(
      networkConfig.escrowContract,
      ESCROW_ABI,
      signer
    );

    // Handle different currencies
    if (currency === network.name) {
      // Native currency (ETH/MATIC)
      const tx = await this.escrowContract.createEscrow(
        seller.wallet_address,
        ethers.utils.parseEther(amount.toString()),
        { value: ethers.utils.parseEther(amount.toString()) }
      );
      const receipt = await tx.wait();
      const event = receipt.events?.find(e => e.event === 'EscrowCreated');
      return event?.args?.escrowId.toString();
    } else {
      // ERC20 tokens
      const token = networkConfig.tokens[currency];
      if (!token) throw new Error('Unsupported token');

      const tokenContract = new ethers.Contract(token.address, ERC20_ABI, signer);
      const tokenAmount = ethers.utils.parseUnits(amount.toString(), token.decimals);

      // Approve token spending
      const approveTx = await tokenContract.approve(networkConfig.escrowContract, tokenAmount);
      await approveTx.wait();

      // Create escrow
      const tx = await this.escrowContract.createEscrow(
        seller.wallet_address,
        tokenAmount
      );
      const receipt = await tx.wait();
      const event = receipt.events?.find(e => e.event === 'EscrowCreated');
      return event?.args?.escrowId.toString();
    }
  }

  async releaseEscrow(escrowId: string) {
    if (!this.escrowContract) throw new Error('Escrow contract not initialized');
    const tx = await this.escrowContract.releaseEscrow(escrowId);
    await tx.wait();
  }

  async refundEscrow(escrowId: string) {
    if (!this.escrowContract) throw new Error('Escrow contract not initialized');
    const tx = await this.escrowContract.refundEscrow(escrowId);
    await tx.wait();
  }

  async disputeEscrow(escrowId: string) {
    if (!this.escrowContract) throw new Error('Escrow contract not initialized');
    const tx = await this.escrowContract.disputeEscrow(escrowId);
    await tx.wait();
  }

  async resolveDispute(escrowId: string, releaseFunds: boolean) {
    if (!this.escrowContract) throw new Error('Escrow contract not initialized');
    const tx = await this.escrowContract.resolveDispute(escrowId, releaseFunds);
    await tx.wait();
  }

  async initializePayment(orderId: string, purchaseData: any) {
    try {
      // Update order status
      const { error: updateError } = await supabase
        .from('marketplace_orders')
        .update({ status: 'processing' })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Handle crypto payment
      if (purchaseData.paymentMethod.startsWith('crypto_')) {
        const escrowId = await this.createEscrow(
          purchaseData.seller_id,
          purchaseData.amount,
          purchaseData.currency
        );

        // Update order with escrow info
        const { error: escrowError } = await supabase
          .from('marketplace_orders')
          .update({
            escrow_id: escrowId,
            status: 'pending_confirmation'
          })
          .eq('id', orderId);

        if (escrowError) throw escrowError;
      } else {
        // Handle traditional payment methods (e.g., Stripe)
        // Implementation for other payment methods would go here
      }
    } catch (error) {
      // Revert order status on error
      await supabase
        .from('marketplace_orders')
        .update({ status: 'failed' })
        .eq('id', orderId);

      throw error;
    }
  }
} 