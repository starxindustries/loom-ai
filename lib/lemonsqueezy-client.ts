import {
  LemonSqueezyCheckoutSession,
  LemonSqueezySubscription,
  CheckoutSessionRequest,
  SubscriptionPlan
} from '../types/subscription';

export class LemonSqueezyClient {
  private apiKey: string;
  private storeId: string;
  private baseUrl = 'https://api.lemonsqueezy.com/v1';

  constructor(apiKey?: string, storeId?: string) {
    this.apiKey = apiKey || process.env.LEMONSQUEEZY_API_KEY || '';
    this.storeId = storeId || process.env.LEMONSQUEEZY_STORE_ID || '';
    
    if (!this.apiKey || !this.storeId) {
      throw new Error('LemonSqueezy API key and store ID are required');
    }
  }

  /**
   * Create a checkout session
   */
  async createCheckout(plan: SubscriptionPlan, request: CheckoutSessionRequest): Promise<LemonSqueezyCheckoutSession> {
    if (!plan.lemonsqueezyVariantId) {
      throw new Error('Plan missing LemonSqueezy variant ID');
    }

    const checkoutData = {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_options: {
            embed: false,
            media: true,
            logo: true,
            desc: true,
            discount: true,
            dark: false,
            subscription_preview: true
          },
          checkout_data: {
            custom: {
              user_id: request.userId,
              plan_id: request.planId,
              ...request.customData
            },
            variant_quantities: [
              {
                variant_id: parseInt(plan.lemonsqueezyVariantId),
                quantity: 1
              }
            ]
          },
          product_options: {
            name: plan.name,
            description: `${plan.name} subscription plan`,
            redirect_url: request.successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
            receipt_button_text: 'Go to Dashboard',
            receipt_link_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
            receipt_thank_you_note: 'Thank you for your subscription!'
          },
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: this.storeId
            }
          },
          variant: {
            data: {
              type: 'variants',
              id: plan.lemonsqueezyVariantId
            }
          }
        }
      }
    };

    const response = await this.makeRequest('POST', '/checkouts', checkoutData);
    return response as LemonSqueezyCheckoutSession;
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<LemonSqueezySubscription> {
    const response = await this.makeRequest('GET', `/subscriptions/${subscriptionId}`);
    return response as LemonSqueezySubscription;
  }

  /**
   * Update subscription
   */
  async updateSubscription(subscriptionId: string, variantId: string): Promise<LemonSqueezySubscription> {
    const updateData = {
      data: {
        type: 'subscriptions',
        id: subscriptionId,
        attributes: {
          variant_id: parseInt(variantId)
        }
      }
    };

    const response = await this.makeRequest('PATCH', `/subscriptions/${subscriptionId}`, updateData);
    return response as LemonSqueezySubscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.makeRequest('DELETE', `/subscriptions/${subscriptionId}`);
  }

  /**
   * Make authenticated request to LemonSqueezy API
   */
  private async makeRequest(method: string, endpoint: string, data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    };

    if (data && (method === 'POST' || method === 'PATCH')) {
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/vnd.api+json'
      };
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorData = await response.json();
        errorMessage = errorData.errors?.[0]?.detail || errorMessage;
      } catch {
        // If we can't parse the error response, use the status text
      }
      throw new Error(`LemonSqueezy API error: ${errorMessage}`);
    }

    // DELETE requests typically don't return content
    if (method === 'DELETE') {
      return;
    }

    return await response.json();
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   */
  static verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload, 'utf8');
      const expectedSignature = hmac.digest('hex');
      
      // LemonSqueezy sends signature in format "sha256=<hash>"
      const receivedSignature = signature.replace('sha256=', '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex')
      );
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const lemonSqueezyClient = new LemonSqueezyClient();