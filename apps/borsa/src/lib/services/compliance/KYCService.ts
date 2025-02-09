import { supabase } from '$lib/supabaseClient';
import type { ApiResponse } from '@tiktok-toe/shared';

interface KYCDocument {
  id: string;
  type: 'passport' | 'national_id' | 'drivers_license' | 'utility_bill';
  status: 'pending' | 'verified' | 'rejected';
  documentUrl: string;
  verificationNotes?: string;
  expiryDate?: string;
}

interface KYCLevel {
  level: 1 | 2 | 3;
  requirements: {
    documents: string[];
    limits: {
      daily: number;
      monthly: number;
      annual: number;
    };
    features: string[];
  };
}

export class KYCService {
  private static instance: KYCService;
  private readonly KYC_LEVELS: Record<number, KYCLevel> = {
    1: {
      level: 1,
      requirements: {
        documents: ['email_verification'],
        limits: {
          daily: 1000,
          monthly: 5000,
          annual: 50000
        },
        features: ['crypto_wallet', 'basic_transfer']
      }
    },
    2: {
      level: 2,
      requirements: {
        documents: ['government_id', 'proof_of_address'],
        limits: {
          daily: 10000,
          monthly: 50000,
          annual: 500000
        },
        features: ['fiat_wallet', 'bank_transfer', 'exchange']
      }
    },
    3: {
      level: 3,
      requirements: {
        documents: ['government_id', 'proof_of_address', 'proof_of_income', 'tax_documents'],
        limits: {
          daily: 100000,
          monthly: 500000,
          annual: 5000000
        },
        features: ['otc_trading', 'margin_trading', 'institutional']
      }
    }
  };

  private constructor() {}

  static getInstance(): KYCService {
    if (!KYCService.instance) {
      KYCService.instance = new KYCService();
    }
    return KYCService.instance;
  }

  async submitDocument(document: {
    type: KYCDocument['type'];
    file: File;
    metadata?: Record<string, any>;
  }): Promise<ApiResponse<KYCDocument>> {
    try {
      // Upload document to secure storage
      const { data: fileData, error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(`${supabase.auth.user()?.id}/${document.type}`, document.file, {
          cacheControl: '0',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Create document record
      const { data, error } = await supabase
        .from('kyc_documents')
        .insert({
          user_id: supabase.auth.user()?.id,
          type: document.type,
          document_url: fileData.path,
          metadata: document.metadata,
          status: 'pending'
        })
        .single();

      if (error) throw error;

      // Trigger automated verification process
      await this.initiateVerification(data.id);

      return { data };
    } catch (err) {
      console.error('Failed to submit KYC document:', err);
      return { error: 'Failed to submit KYC document' };
    }
  }

  async getCurrentLevel(): Promise<ApiResponse<number>> {
    try {
      const { data, error } = await supabase
        .from('user_kyc')
        .select('level, status')
        .eq('user_id', supabase.auth.user()?.id)
        .single();

      if (error) throw error;

      return { data: data.status === 'verified' ? data.level : 0 };
    } catch (err) {
      console.error('Failed to get KYC level:', err);
      return { error: 'Failed to get KYC level' };
    }
  }

  async checkTransactionCompliance(params: {
    amount: number;
    currency: string;
    type: 'crypto' | 'fiat';
  }): Promise<ApiResponse<boolean>> {
    try {
      const { data: level } = await this.getCurrentLevel();
      if (!level) throw new Error('KYC level not found');

      const kycLevel = this.KYC_LEVELS[level];
      
      // Check transaction limits
      const { data: periodTotals } = await supabase
        .rpc('get_transaction_totals', {
          user_id: supabase.auth.user()?.id,
          currency: params.currency
        });

      if (
        params.amount > kycLevel.requirements.limits.daily ||
        periodTotals.daily + params.amount > kycLevel.requirements.limits.daily ||
        periodTotals.monthly + params.amount > kycLevel.requirements.limits.monthly ||
        periodTotals.annual + params.amount > kycLevel.requirements.limits.annual
      ) {
        return { data: false };
      }

      // Check feature availability
      const requiredFeature = params.type === 'crypto' ? 'crypto_wallet' : 'fiat_wallet';
      if (!kycLevel.requirements.features.includes(requiredFeature)) {
        return { data: false };
      }

      return { data: true };
    } catch (err) {
      console.error('Failed to check compliance:', err);
      return { error: 'Failed to check compliance' };
    }
  }

  private async initiateVerification(documentId: string): Promise<void> {
    // Integrate with third-party KYC provider (e.g., Jumio, Onfido)
    // Implement sanctions screening
    // Check against AML databases
  }
}

export const kycService = KYCService.getInstance(); 