export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  seller: {
    id: string;
    username: string;
    avatar_url: string;
    verified: boolean;
    bio?: string;
    languages?: string[];
    location?: string;
    response_time?: string;
    sales_count?: number;
    rating?: number;
    review_count?: number;
    joined_at?: string;
  };
  categories?: {
    id: string;
    name: string;
    slug: string;
  }[];
  token_gated: boolean;
  token_contract?: string;
  token_id?: string;
  token_standard?: string;
  nft: boolean;
  stock?: number;
  views: number;
  created_at: string;
  reviews?: {
    id: string;
    rating: number;
    comment: string;
    created_at: string;
    reviewer: {
      id: string;
      username: string;
      avatar_url: string;
    };
  }[];
}

export interface ProductFilter {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  seller?: string;
  tokenGated?: boolean;
  nft?: boolean;
  search?: string;
}

export interface ProductSort {
  field: 'price' | 'created_at' | 'views' | 'rating';
  direction: 'asc' | 'desc';
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parent_id?: string;
  created_at: string;
}

export interface Review {
  id: string;
  product_id: string;
  reviewer_id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer?: {
    id: string;
    username: string;
    avatar_url: string;
  };
}

export interface Order {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  status: 'pending' | 'paid' | 'delivered' | 'completed' | 'cancelled' | 'disputed';
  amount: number;
  currency: string;
  payment_method: 'crypto' | 'fiat';
  transaction_hash?: string;
  escrow_id?: string;
  shipping_address?: {
    name: string;
    street: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
    phone?: string;
  };
  tracking_number?: string;
  tracking_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Dispute {
  id: string;
  order_id: string;
  initiator_id: string;
  respondent_id: string;
  reason: string;
  evidence: string[];
  status: 'open' | 'resolved' | 'closed';
  resolution?: 'refund' | 'release' | 'partial_refund';
  resolution_amount?: number;
  resolution_notes?: string;
  mediator_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_id: string;
  message: string;
  attachments?: string[];
  created_at: string;
}

export interface TokenGateConfig {
  contract_address: string;
  token_id?: string;
  token_standard: 'ERC721' | 'ERC1155' | 'ERC20';
  min_balance?: string;
  chain_id: number;
} 