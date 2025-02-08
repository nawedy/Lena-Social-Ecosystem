import { supabase } from '$lib/supabaseClient';
import { web3Service } from '$lib/services/web3';
import { ipfsService } from '$lib/services/ipfs';
import type { Product, ProductFilter, ProductSort, Category, Review, TokenGateConfig } from '$lib/types/marketplace';

export class MarketplaceService {
  /**
   * List products with filtering, sorting, and pagination
   */
  async listProducts(
    filter?: ProductFilter,
    sort?: ProductSort,
    page = 1,
    limit = 12
  ) {
    try {
      let query = supabase
        .from('marketplace_products')
        .select(`
          *,
          seller:seller_id (
            id,
            username,
            avatar_url,
            verified,
            bio,
            languages,
            location,
            response_time,
            sales_count,
            rating,
            review_count,
            joined_at
          ),
          categories:marketplace_product_categories (
            category:category_id (
              id,
              name,
              slug
            )
          )
        `);

      // Apply filters
      if (filter) {
        if (filter.category) {
          query = query.eq('categories.category.slug', filter.category);
        }
        if (filter.minPrice) {
          query = query.gte('price', filter.minPrice);
        }
        if (filter.maxPrice) {
          query = query.lte('price', filter.maxPrice);
        }
        if (filter.seller) {
          query = query.eq('seller_id', filter.seller);
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

      const { data: products, error, count } = await query;

      if (error) throw error;

      return {
        products,
        total: count || 0,
        page,
        limit
      };
    } catch (error) {
      console.error('Failed to list products:', error);
      throw error;
    }
  }

  /**
   * Get a single product by ID
   */
  async getProduct(id: string) {
    try {
      const { data: product, error } = await supabase
        .from('marketplace_products')
        .select(`
          *,
          seller:seller_id (
            id,
            username,
            avatar_url,
            verified,
            bio,
            languages,
            location,
            response_time,
            sales_count,
            rating,
            review_count,
            joined_at
          ),
          categories:marketplace_product_categories (
            category:category_id (
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

      // Increment view count
      await supabase
        .from('marketplace_products')
        .update({ views: (product.views || 0) + 1 })
        .eq('id', id);

      return product;
    } catch (error) {
      console.error('Failed to get product:', error);
      throw error;
    }
  }

  /**
   * Create a new product listing
   */
  async createProduct(product: Omit<Product, 'id' | 'created_at'>) {
    try {
      // Upload images to IPFS
      const imageHashes = await Promise.all(
        product.images.map(async (image) => {
          const result = await ipfsService.upload(image);
          return result.cid;
        })
      );

      // Create product
      const { data: newProduct, error } = await supabase
        .from('marketplace_products')
        .insert({
          ...product,
          images: imageHashes,
          views: 0
        })
        .select()
        .single();

      if (error) throw error;

      // Add categories
      if (product.categories?.length) {
        const categoryLinks = product.categories.map((category) => ({
          product_id: newProduct.id,
          category_id: category.id
        }));

        const { error: categoryError } = await supabase
          .from('marketplace_product_categories')
          .insert(categoryLinks);

        if (categoryError) throw categoryError;
      }

      return newProduct;
    } catch (error) {
      console.error('Failed to create product:', error);
      throw error;
    }
  }

  /**
   * Update an existing product
   */
  async updateProduct(id: string, updates: Partial<Product>) {
    try {
      // Upload any new images to IPFS
      if (updates.images) {
        const imageHashes = await Promise.all(
          updates.images.map(async (image) => {
            if (image.startsWith('ipfs://')) return image;
            const result = await ipfsService.upload(image);
            return result.cid;
          })
        );
        updates.images = imageHashes;
      }

      // Update product
      const { data: updatedProduct, error } = await supabase
        .from('marketplace_products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update categories if provided
      if (updates.categories) {
        // Remove existing categories
        await supabase
          .from('marketplace_product_categories')
          .delete()
          .eq('product_id', id);

        // Add new categories
        const categoryLinks = updates.categories.map((category) => ({
          product_id: id,
          category_id: category.id
        }));

        const { error: categoryError } = await supabase
          .from('marketplace_product_categories')
          .insert(categoryLinks);

        if (categoryError) throw categoryError;
      }

      return updatedProduct;
    } catch (error) {
      console.error('Failed to update product:', error);
      throw error;
    }
  }

  /**
   * Delete a product by ID
   */
  async deleteProduct(id: string) {
    try {
      const { error } = await supabase
        .from('marketplace_products')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete product:', error);
      throw error;
    }
  }

  /**
   * Get all product categories
   */
  async getCategories() {
    try {
      const { data: categories, error } = await supabase
        .from('marketplace_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      return categories;
    } catch (error) {
      console.error('Failed to get categories:', error);
      throw error;
    }
  }

  /**
   * Create a review for a product
   */
  async createReview(productId: string, review: {
    rating: number;
    comment: string;
    reviewerId: string;
  }) {
    try {
      const { data: newReview, error } = await supabase
        .from('marketplace_reviews')
        .insert({
          product_id: productId,
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

      // Update product rating
      const { data: reviews } = await supabase
        .from('marketplace_reviews')
        .select('rating')
        .eq('product_id', productId);

      const averageRating = reviews?.reduce((acc, r) => acc + r.rating, 0) / (reviews?.length || 1);

      await supabase
        .from('marketplace_products')
        .update({ rating: averageRating })
        .eq('id', productId);

      return newReview;
    } catch (error) {
      console.error('Failed to create review:', error);
      throw error;
    }
  }

  /**
   * Check if a user has access to a token-gated product
   */
  async checkTokenAccess(productId: string, userId: string) {
    try {
      const { data: product, error } = await supabase
        .from('marketplace_products')
        .select('token_contract, token_id, token_standard')
        .eq('id', productId)
        .single();

      if (error) throw error;

      if (!product.token_contract) return true;

      const { data: user } = await supabase
        .from('profiles')
        .select('wallet_address')
        .eq('id', userId)
        .single();

      if (!user?.wallet_address) return false;

      return await web3Service.checkTokenOwnership(
        user.wallet_address,
        product.token_contract,
        product.token_id,
        product.token_standard
      );
    } catch (error) {
      console.error('Failed to check token access:', error);
      return false;
    }
  }
}

export const marketplaceService = new MarketplaceService(); 