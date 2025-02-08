import { supabase } from '$lib/supabaseClient';
import { ipfsService } from '$lib/services/ipfs';
import { web3Service } from '$lib/services/web3';
import type { AudioTrack, AudioFilter, AudioSort } from '$lib/types/audio';

export class AudioService {
  /**
   * List audio tracks with filtering, sorting, and pagination
   */
  async listTracks(
    filter?: AudioFilter,
    sort?: AudioSort,
    page = 1,
    limit = 12
  ) {
    try {
      let query = supabase
        .from('audio_tracks')
        .select(`
          *,
          artist:artist_id (
            id,
            username,
            avatar_url,
            verified,
            bio,
            genres,
            location,
            followers_count,
            tracks_count,
            rating,
            review_count,
            joined_at
          ),
          genres:audio_track_genres (
            genre:genre_id (
              id,
              name,
              slug
            )
          )
        `);

      // Apply filters
      if (filter) {
        if (filter.genre) {
          query = query.eq('genres.genre.slug', filter.genre);
        }
        if (filter.minPrice) {
          query = query.gte('price', filter.minPrice);
        }
        if (filter.maxPrice) {
          query = query.lte('price', filter.maxPrice);
        }
        if (filter.artist) {
          query = query.eq('artist_id', filter.artist);
        }
        if (filter.minBpm) {
          query = query.gte('bpm', filter.minBpm);
        }
        if (filter.maxBpm) {
          query = query.lte('bpm', filter.maxBpm);
        }
        if (filter.key) {
          query = query.eq('key', filter.key);
        }
        if (filter.tokenGated !== undefined) {
          query = query.eq('token_gated', filter.tokenGated);
        }
        if (filter.nft !== undefined) {
          query = query.eq('nft', filter.nft);
        }
        if (filter.search) {
          query = query.or(`title.ilike.%${filter.search}%,description.ilike.%${filter.search}%`);
        }
      }

      // Apply sorting
      if (sort) {
        query = query.order(sort.field, { ascending: sort.direction === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data: tracks, error, count } = await query;

      if (error) throw error;

      return {
        tracks,
        total: count || 0,
        page,
        limit
      };
    } catch (error) {
      console.error('Failed to list tracks:', error);
      throw error;
    }
  }

  /**
   * Get a single track by ID
   */
  async getTrack(id: string) {
    try {
      const { data: track, error } = await supabase
        .from('audio_tracks')
        .select(`
          *,
          artist:artist_id (
            id,
            username,
            avatar_url,
            verified,
            bio,
            genres,
            location,
            followers_count,
            tracks_count,
            rating,
            review_count,
            joined_at
          ),
          genres:audio_track_genres (
            genre:genre_id (
              id,
              name,
              slug
            )
          ),
          reviews (
            id,
            rating,
            comment,
            created_at,
            reviewer:reviewer_id (
              id,
              username,
              avatar_url
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Increment play count
      await supabase
        .from('audio_tracks')
        .update({ plays: (track.plays || 0) + 1 })
        .eq('id', id);

      return track;
    } catch (error) {
      console.error('Failed to get track:', error);
      throw error;
    }
  }

  /**
   * Create a new audio track
   */
  async createTrack(track: Omit<AudioTrack, 'id' | 'created_at'>) {
    try {
      // Upload audio file and artwork to IPFS
      const [audioResult, artworkResult] = await Promise.all([
        ipfsService.upload(track.audioFile),
        ipfsService.upload(track.artwork)
      ]);

      // Create track
      const { data: newTrack, error } = await supabase
        .from('audio_tracks')
        .insert({
          ...track,
          audio_url: audioResult.cid,
          artwork_url: artworkResult.cid,
          plays: 0,
          downloads: 0
        })
        .select()
        .single();

      if (error) throw error;

      // Add genres
      if (track.genres?.length) {
        const genreLinks = track.genres.map((genre) => ({
          track_id: newTrack.id,
          genre_id: genre.id
        }));

        const { error: genreError } = await supabase
          .from('audio_track_genres')
          .insert(genreLinks);

        if (genreError) throw genreError;
      }

      return newTrack;
    } catch (error) {
      console.error('Failed to create track:', error);
      throw error;
    }
  }

  /**
   * Update an existing track
   */
  async updateTrack(id: string, updates: Partial<AudioTrack>) {
    try {
      // Upload any new files to IPFS
      if (updates.audioFile) {
        const audioResult = await ipfsService.upload(updates.audioFile);
        updates.audio_url = audioResult.cid;
      }
      if (updates.artwork) {
        const artworkResult = await ipfsService.upload(updates.artwork);
        updates.artwork_url = artworkResult.cid;
      }

      // Update track
      const { data: updatedTrack, error } = await supabase
        .from('audio_tracks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update genres if provided
      if (updates.genres) {
        // Remove existing genres
        await supabase
          .from('audio_track_genres')
          .delete()
          .eq('track_id', id);

        // Add new genres
        const genreLinks = updates.genres.map((genre) => ({
          track_id: id,
          genre_id: genre.id
        }));

        const { error: genreError } = await supabase
          .from('audio_track_genres')
          .insert(genreLinks);

        if (genreError) throw genreError;
      }

      return updatedTrack;
    } catch (error) {
      console.error('Failed to update track:', error);
      throw error;
    }
  }

  /**
   * Delete a track by ID
   */
  async deleteTrack(id: string) {
    try {
      const { error } = await supabase
        .from('audio_tracks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete track:', error);
      throw error;
    }
  }

  /**
   * Get all audio genres
   */
  async getGenres() {
    try {
      const { data: genres, error } = await supabase
        .from('audio_genres')
        .select('*')
        .order('name');

      if (error) throw error;
      return genres;
    } catch (error) {
      console.error('Failed to get genres:', error);
      throw error;
    }
  }

  /**
   * Create a review for a track
   */
  async createReview(trackId: string, review: {
    rating: number;
    comment: string;
    reviewerId: string;
  }) {
    try {
      const { data: newReview, error } = await supabase
        .from('audio_reviews')
        .insert({
          track_id: trackId,
          reviewer_id: review.reviewerId,
          rating: review.rating,
          comment: review.comment
        })
        .select(`
          *,
          reviewer:reviewer_id (
            id,
            username,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      // Update track rating
      const { data: reviews } = await supabase
        .from('audio_reviews')
        .select('rating')
        .eq('track_id', trackId);

      const averageRating = reviews?.reduce((acc, r) => acc + r.rating, 0) / (reviews?.length || 1);

      await supabase
        .from('audio_tracks')
        .update({ rating: averageRating })
        .eq('id', trackId);

      return newReview;
    } catch (error) {
      console.error('Failed to create review:', error);
      throw error;
    }
  }

  /**
   * Check if a user has access to a token-gated track
   */
  async checkTokenAccess(trackId: string, userId: string) {
    try {
      const { data: track, error } = await supabase
        .from('audio_tracks')
        .select('token_contract, token_id, token_standard')
        .eq('id', trackId)
        .single();

      if (error) throw error;

      if (!track.token_contract) return true;

      const { data: user } = await supabase
        .from('profiles')
        .select('wallet_address')
        .eq('id', userId)
        .single();

      if (!user?.wallet_address) return false;

      return await web3Service.checkTokenOwnership(
        user.wallet_address,
        track.token_contract,
        track.token_id,
        track.token_standard
      );
    } catch (error) {
      console.error('Failed to check token access:', error);
      return false;
    }
  }
}

export const audioService = new AudioService(); 