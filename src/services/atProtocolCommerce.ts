import { BskyAgent, RichText } from '@atproto/api';

export interface Product {
  uri: string;
  cid: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  variants?: {
    name: string;
    options: string[];
    prices: Record<string, number>;
  }[];
  inventory: number;
  tags: string[];
  category: string;
  seller: {
    did: string;
    handle: string;
    displayName: string;
  };
  shippingInfo?: {
    methods: {
      name: string;
      price: number;
      estimatedDays: number;
    }[];
    restrictions?: string[];
  };
  createdAt: string;
}

export interface Order {
  uri: string;
  cid: string;
  buyer: {
    did: string;
    handle: string;
  };
  seller: {
    did: string;
    handle: string;
  };
  products: Array<{
    uri: string;
    quantity: number;
    variant?: string;
    price: number;
  }>;
  shipping: {
    method: string;
    address: string;
    price: number;
  };
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export class ATProtocolCommerce {
  private agent: BskyAgent;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  // Product Management
  public async createProduct(params: {
    name: string;
    description: string;
    price: number;
    currency: string;
    images: Blob[];
    variants?: Product['variants'];
    inventory: number;
    tags: string[];
    category: string;
    shippingInfo?: Product['shippingInfo'];
  }): Promise<Product> {
    // Upload product images
    const imageBlobs = await Promise.all(
      params.images.map(image => this.agent.uploadBlob(image))
    );

    const record = {
      $type: 'app.bsky.commerce.product',
      name: params.name,
      description: params.description,
      price: params.price,
      currency: params.currency,
      images: imageBlobs.map(blob => blob.data.blob),
      variants: params.variants,
      inventory: params.inventory,
      tags: params.tags,
      category: params.category,
      shippingInfo: params.shippingInfo,
      createdAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.product',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      ...record,
      seller: {
        did: this.agent.session?.did ?? '',
        handle: this.agent.session?.handle ?? '',
        displayName: this.agent.session?.displayName ?? '',
      },
    };
  }

  // Shopping Cart
  public async addToCart(
    productUri: string,
    quantity: number = 1,
    variant?: string
  ): Promise<void> {
    const record = {
      $type: 'app.bsky.commerce.cartItem',
      product: productUri,
      quantity,
      variant,
      addedAt: new Date().toISOString(),
    };

    await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.cartItem',
      record,
    });
  }

  // Order Management
  public async createOrder(params: {
    products: Array<{
      uri: string;
      quantity: number;
      variant?: string;
    }>;
    shipping: {
      method: string;
      address: string;
    };
  }): Promise<Order> {
    // Get product details and calculate total
    const productDetails = await Promise.all(
      params.products.map(async item => {
        const product = await this.getProduct(item.uri);
        const price =
          item.variant && product.variants
            ? (product.variants.find(v => v.options.includes(item.variant))
                ?.prices[item.variant] ?? product.price)
            : product.price;

        return {
          ...item,
          price: price * item.quantity,
        };
      })
    );

    const shippingMethod = await this.getShippingMethod(params.shipping.method);

    const record = {
      $type: 'app.bsky.commerce.order',
      products: productDetails,
      shipping: {
        ...params.shipping,
        price: shippingMethod.price,
      },
      status: 'pending' as const,
      totalAmount:
        productDetails.reduce((sum, item) => sum + item.price, 0) +
        shippingMethod.price,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const response = await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.order',
      record,
    });

    return {
      uri: response.uri,
      cid: response.cid,
      buyer: {
        did: this.agent.session?.did ?? '',
        handle: this.agent.session?.handle ?? '',
      },
      seller: {
        did: productDetails[0].seller.did,
        handle: productDetails[0].seller.handle,
      },
      ...record,
    };
  }

  // Product Discovery
  public async searchProducts(
    query: string,
    params?: {
      category?: string;
      minPrice?: number;
      maxPrice?: number;
      tags?: string[];
      limit?: number;
      cursor?: string;
    }
  ): Promise<{
    products: Product[];
    cursor?: string;
  }> {
    const response = await this.agent.api.app.bsky.commerce.searchProducts({
      q: query,
      ...params,
    });

    return {
      products: response.data.products,
      cursor: response.data.cursor,
    };
  }

  // Reviews and Ratings
  public async addProductReview(params: {
    productUri: string;
    rating: number;
    text: string;
    media?: Blob[];
  }): Promise<void> {
    const rt = new RichText({ text: params.text });
    await rt.detectFacets(this.agent);

    const mediaBlobs = await Promise.all(
      (params.media || []).map(blob => this.agent.uploadBlob(blob))
    );

    const record = {
      $type: 'app.bsky.commerce.review',
      product: params.productUri,
      rating: params.rating,
      text: rt.text,
      facets: rt.facets,
      media: mediaBlobs.map(blob => blob.data.blob),
      createdAt: new Date().toISOString(),
    };

    await this.agent.api.com.atproto.repo.createRecord({
      repo: this.agent.session?.did ?? '',
      collection: 'app.bsky.commerce.review',
      record,
    });
  }

  // Product Analytics
  public async getProductAnalytics(productUri: string): Promise<{
    views: number;
    saves: number;
    purchases: number;
    averageRating: number;
    reviewCount: number;
    revenueByDay: Array<{
      date: string;
      revenue: number;
      orders: number;
    }>;
  }> {
    const response = await this.agent.api.app.bsky.commerce.getProductAnalytics(
      {
        product: productUri,
      }
    );

    return response.data;
  }

  // Helper Methods
  private async getProduct(uri: string): Promise<Product> {
    const response = await this.agent.api.app.bsky.commerce.getProduct({
      uri,
    });

    return response.data;
  }

  private async getShippingMethod(method: string): Promise<{
    name: string;
    price: number;
    estimatedDays: number;
  }> {
    // In a real implementation, this would fetch from a shipping service
    return {
      name: method,
      price: 10,
      estimatedDays: 3,
    };
  }
}
