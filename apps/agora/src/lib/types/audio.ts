export interface AudioTrack {
  id: string;
  title: string;
  description: string;
  audio_url: string;
  artwork_url: string;
  preview_url: string;
  duration: number;
  price: number;
  currency: string;
  artist_id: string;
  artist?: {
    id: string;
    username: string;
    avatar_url: string;
    verified: boolean;
    bio: string;
    genres: string[];
    location: string;
    followers_count: number;
    tracks_count: number;
    rating: number;
    review_count: number;
    joined_at: string;
  };
  genres?: {
    id: string;
    name: string;
    slug: string;
  }[];
  bpm: number;
  key: string;
  plays: number;
  downloads: number;
  rating: number;
  review_count: number;
  token_gated: boolean;
  token_contract?: string;
  token_id?: string;
  token_standard?: 'ERC721' | 'ERC1155' | 'ERC20';
  nft: boolean;
  created_at: string;
  updated_at: string;
  // For file uploads
  audioFile?: File;
  artwork?: File;
}

export interface AudioFilter {
  genre?: string;
  minPrice?: number;
  maxPrice?: number;
  artist?: string;
  minBpm?: number;
  maxBpm?: number;
  key?: string;
  tokenGated?: boolean;
  nft?: boolean;
  search?: string;
}

export interface AudioSort {
  field: 'price' | 'created_at' | 'plays' | 'downloads' | 'rating' | 'bpm';
  direction: 'asc' | 'desc';
}

export interface AudioGenre {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parent_id?: string;
  created_at: string;
}

export interface AudioReview {
  id: string;
  track_id: string;
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

export interface AudioLicense {
  id: string;
  track_id: string;
  buyer_id: string;
  seller_id: string;
  type: 'basic' | 'premium' | 'exclusive';
  price: number;
  currency: string;
  rights: string[];
  restrictions: string[];
  territory: 'worldwide' | string[];
  duration: 'perpetual' | number;
  created_at: string;
}

export interface AudioOrder {
  id: string;
  track_id: string;
  buyer_id: string;
  seller_id: string;
  license_id?: string;
  status: 'pending' | 'paid' | 'delivered' | 'completed' | 'cancelled' | 'disputed';
  amount: number;
  currency: string;
  payment_method: 'crypto' | 'fiat';
  transaction_hash?: string;
  escrow_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AudioDispute {
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

export interface AudioStats {
  total_tracks: number;
  total_artists: number;
  total_sales: number;
  total_volume: number;
  average_price: number;
  top_genres: {
    genre: string;
    count: number;
  }[];
  top_artists: {
    artist: {
      id: string;
      username: string;
      avatar_url: string;
    };
    sales: number;
    volume: number;
  }[];
  recent_sales: {
    track: {
      id: string;
      title: string;
      artwork_url: string;
    };
    price: number;
    currency: string;
    created_at: string;
  }[];
} 