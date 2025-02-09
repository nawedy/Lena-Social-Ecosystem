export type TransactionType = 'send' | 'receive' | 'exchange' | 'stake' | 'unstake' | 'reward';
export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  timestamp: number;
  fee: number;
  metadata?: Record<string, any>;
} 