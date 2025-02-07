import { supabase } from '$lib/supabaseClient';
import { PaymentService } from './PaymentService';

interface DisputeEvidence {
  type: 'text' | 'image' | 'document';
  content: string;
  timestamp: string;
  submittedBy: string;
}

interface DisputeResolution {
  decision: 'refund' | 'release' | 'partial_refund';
  amount?: number;
  reason: string;
  mediatorId: string;
  timestamp: string;
}

interface DisputeMessage {
  senderId: string;
  content: string;
  timestamp: string;
  attachments?: string[];
}

export class DisputeService {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  // Create a new dispute for an order
  async createDispute(
    orderId: string,
    reason: string,
    description: string,
    evidence?: DisputeEvidence[]
  ) {
    try {
      // Get order details
      const { data: order, error: orderError } = await supabase
        .from('marketplace_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Create dispute record
      const { data: dispute, error: disputeError } = await supabase
        .from('marketplace_disputes')
        .insert({
          order_id: orderId,
          initiator_id: order.buyer_id,
          respondent_id: order.seller_id,
          reason,
          description,
          status: 'opened',
          evidence: evidence || [],
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (disputeError) throw disputeError;

      // Update order status
      const { error: updateError } = await supabase
        .from('marketplace_orders')
        .update({ status: 'disputed' })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // If order uses escrow, initiate dispute on the smart contract
      if (order.escrow_id) {
        await this.paymentService.disputeEscrow(order.escrow_id);
      }

      // Notify relevant parties
      await this.notifyDisputeParties(dispute);

      return dispute;
    } catch (error) {
      console.error('Failed to create dispute:', error);
      throw error;
    }
  }

  // Add evidence to an existing dispute
  async addEvidence(disputeId: string, evidence: DisputeEvidence) {
    try {
      const { data: dispute, error: getError } = await supabase
        .from('marketplace_disputes')
        .select('evidence')
        .eq('id', disputeId)
        .single();

      if (getError) throw getError;

      const updatedEvidence = [...(dispute.evidence || []), evidence];

      const { error: updateError } = await supabase
        .from('marketplace_disputes')
        .update({ evidence: updatedEvidence })
        .eq('id', disputeId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Failed to add evidence:', error);
      throw error;
    }
  }

  // Send a message in the dispute thread
  async sendMessage(disputeId: string, message: DisputeMessage) {
    try {
      const { error } = await supabase
        .from('marketplace_dispute_messages')
        .insert({
          dispute_id: disputeId,
          sender_id: message.senderId,
          content: message.content,
          attachments: message.attachments,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  // Get all messages for a dispute
  async getMessages(disputeId: string): Promise<DisputeMessage[]> {
    try {
      const { data, error } = await supabase
        .from('marketplace_dispute_messages')
        .select('*')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get messages:', error);
      throw error;
    }
  }

  // Assign a mediator to the dispute
  async assignMediator(disputeId: string, mediatorId: string) {
    try {
      const { error } = await supabase
        .from('marketplace_disputes')
        .update({
          mediator_id: mediatorId,
          status: 'mediation'
        })
        .eq('id', disputeId);

      if (error) throw error;

      // Notify mediator
      await this.notifyMediator(disputeId, mediatorId);
    } catch (error) {
      console.error('Failed to assign mediator:', error);
      throw error;
    }
  }

  // Resolve a dispute with a decision
  async resolveDispute(disputeId: string, resolution: DisputeResolution) {
    try {
      // Get dispute and order details
      const { data: dispute, error: disputeError } = await supabase
        .from('marketplace_disputes')
        .select('*, order:marketplace_orders(*)')
        .eq('id', disputeId)
        .single();

      if (disputeError) throw disputeError;

      // Update dispute status
      const { error: updateError } = await supabase
        .from('marketplace_disputes')
        .update({
          status: 'resolved',
          resolution,
          resolved_at: new Date().toISOString()
        })
        .eq('id', disputeId);

      if (updateError) throw updateError;

      // Handle escrow based on resolution
      if (dispute.order.escrow_id) {
        switch (resolution.decision) {
          case 'refund':
            await this.paymentService.refundEscrow(dispute.order.escrow_id);
            break;
          case 'release':
            await this.paymentService.releaseEscrow(dispute.order.escrow_id);
            break;
          case 'partial_refund':
            // Handle partial refund logic
            await this.handlePartialRefund(dispute.order, resolution.amount!);
            break;
        }
      }

      // Update order status
      await supabase
        .from('marketplace_orders')
        .update({
          status: resolution.decision === 'refund' ? 'refunded' : 'completed',
          resolution_details: resolution
        })
        .eq('id', dispute.order.id);

      // Notify parties of resolution
      await this.notifyResolution(disputeId, resolution);
    } catch (error) {
      console.error('Failed to resolve dispute:', error);
      throw error;
    }
  }

  // Appeal a dispute resolution
  async appealResolution(disputeId: string, reason: string, newEvidence?: DisputeEvidence[]) {
    try {
      const { error } = await supabase
        .from('marketplace_disputes')
        .update({
          status: 'appealed',
          appeal_reason: reason,
          appeal_evidence: newEvidence,
          appealed_at: new Date().toISOString()
        })
        .eq('id', disputeId);

      if (error) throw error;

      // Notify relevant parties of appeal
      await this.notifyAppeal(disputeId);
    } catch (error) {
      console.error('Failed to appeal resolution:', error);
      throw error;
    }
  }

  // Get dispute statistics for a user
  async getUserDisputeStats(userId: string) {
    try {
      const { data, error } = await supabase
        .from('marketplace_disputes')
        .select('status')
        .or(`initiator_id.eq.${userId},respondent_id.eq.${userId}`);

      if (error) throw error;

      return {
        total: data.length,
        resolved: data.filter(d => d.status === 'resolved').length,
        pending: data.filter(d => ['opened', 'mediation'].includes(d.status)).length,
        appealed: data.filter(d => d.status === 'appealed').length
      };
    } catch (error) {
      console.error('Failed to get user dispute stats:', error);
      throw error;
    }
  }

  // Private helper methods
  private async notifyDisputeParties(dispute: any) {
    // Implementation for notifying parties about new dispute
  }

  private async notifyMediator(disputeId: string, mediatorId: string) {
    // Implementation for notifying assigned mediator
  }

  private async notifyResolution(disputeId: string, resolution: DisputeResolution) {
    // Implementation for notifying parties about dispute resolution
  }

  private async notifyAppeal(disputeId: string) {
    // Implementation for notifying parties about appeal
  }

  private async handlePartialRefund(order: any, amount: number) {
    // Implementation for handling partial refund logic
  }
} 