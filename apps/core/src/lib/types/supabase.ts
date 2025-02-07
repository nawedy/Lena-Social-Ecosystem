export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          eth_address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          eth_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          avatar_url?: string | null;
          eth_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          content: string;
          media_url: string | null;
          media_type: string | null;
          location: unknown | null; // PostGIS GEOGRAPHY type
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          content: string;
          media_url?: string | null;
          media_type?: string | null;
          location?: unknown | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          content?: string;
          media_url?: string | null;
          media_type?: string | null;
          location?: unknown | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      hashtags: {
        Row: {
          id: string;
          tag: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tag: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tag?: string;
          created_at?: string;
        };
      };
      post_hashtags: {
        Row: {
          id: string;
          post_id: string;
          hashtag_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          hashtag_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          hashtag_id?: string;
          created_at?: string;
        };
      };
      post_likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
      post_comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      follows: {
        Row: {
          id: string;
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          follower_id?: string;
          following_id?: string;
          created_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          content: string;
          read_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          receiver_id: string;
          content: string;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          receiver_id?: string;
          content?: string;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      search_hashtags: {
        Args: {
          search_query: string;
        };
        Returns: Array<{
          tag: string;
          count: number;
        }>;
      };
      get_trending_hashtags: {
        Args: Record<string, never>;
        Returns: Array<{
          tag: string;
          count: number;
        }>;
      };
      search_posts_by_location: {
        Args: {
          lat: number;
          long: number;
          radius_km: number;
        };
        Returns: Array<{
          id: string;
          author_id: string;
          content: string;
          media_url: string | null;
          media_type: string | null;
          location: unknown | null;
          created_at: string;
          updated_at: string;
          distance: number;
        }>;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'] & {
  followers?: number;
};

export type Post = Database['public']['Tables']['posts']['Row'] & {
  profiles?: Profile;
  likes?: number;
  comments?: number;
  distance?: number;
  hashtags?: string[];
};

export type PostLike = Database['public']['Tables']['post_likes']['Row'];

export type PostComment = Database['public']['Tables']['post_comments']['Row'] & {
  profiles?: Profile;
};

export type Message = Database['public']['Tables']['messages']['Row'];

export type Hashtag = Database['public']['Tables']['hashtags']['Row'] & {
  count?: number;
}; 