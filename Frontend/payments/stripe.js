// stripe.js - Stripe Payment Integration
class StripePayments {
  constructor(workerUrl) {
    this.workerUrl = workerUrl;
    this.stripe = null;
    this.elements = null;
    this.card = null;
  }

  // Initialize Stripe (call this when the page loads)
  async init(publishableKey) {
    try {
      if (typeof Stripe === 'undefined') {
        throw new Error('Stripe.js not loaded. Make sure to include the Stripe script tag.');
      }
      
      this.stripe = Stripe(publishableKey);
      console.log('Stripe initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
      throw error;
    }
  }

  // Create a one-time payment checkout session
  async createCheckoutSession(priceId, options = {}) {
    try {
      const {
        customerEmail = null,
        successUrl = `${window.location.origin}/success`,
        cancelUrl = `${window.location.origin}/cancel`,
        metadata = {}
      } = options;

      const response = await fetch(`${this.workerUrl}/payments/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          customerEmail,
          successUrl,
          cancelUrl,
          metadata
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { sessionId, url } = await response.json();
      
      // Redirect to Stripe Checkout
      if (url) {
        window.location.href = url;
      } else {
        // Fallback to programmatic redirect
        const result = await this.stripe.redirectToCheckout({ sessionId });
        if (result.error) {
          throw new Error(result.error.message);
        }
      }

      return { sessionId, url };
    } catch (error) {
      console.error('Checkout session creation failed:', error);
      throw error;
    }
  }

  // Create a subscription checkout session
  async createSubscription(priceId, options = {}) {
    try {
      const {
        customerEmail = null,
        successUrl = `${window.location.origin}/subscription-success`,
        cancelUrl = `${window.location.origin}/cancel`,
        trialPeriodDays = null,
        metadata = {}
      } = options;

      const response = await fetch(`${this.workerUrl}/payments/create-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          customerEmail,
          successUrl,
          cancelUrl,
          trialPeriodDays,
          metadata
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create subscription');
      }

      const { sessionId, url } = await response.json();
      
      // Redirect to Stripe Checkout
      if (url) {
        window.location.href = url;
      } else {
        // Fallback to programmatic redirect
        const result = await this.stripe.redirectToCheckout({ sessionId });
        if (result.error) {
          throw new Error(result.error.message);
        }
      }

      return { sessionId, url };
    } catch (error) {
      console.error('Subscription creation failed:', error);
      throw error;
    }
  }

  // Create embedded payment form (alternative to Checkout)
  async createPaymentForm(containerId, options = {}) {
    try {
      if (!this.stripe) {
        throw new Error('Stripe not initialized. Call init() first.');
      }

      const {
        appearance = {
          theme: 'stripe',
          variables: {
            colorPrimary: '#0570de',
          },
        },
        clientSecret = null
      } = options;

      this.elements = this.stripe.elements({ appearance, clientSecret });
      
      this.card = this.elements.create('card', {
        style: {
          base: {
            fontSize: '16px',
            color: '#424770',
            '::placeholder': {
              color: '#aab7c4',
            },
          },
          invalid: {
            color: '#9e2146',
          },
        },
      });

      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Container with ID ${containerId} not found`);
      }

      this.card.mount(`#${containerId}`);

      // Handle real-time validation errors from the card Element
      this.card.on('change', ({ error }) => {
        const displayError = document.getElementById('card-errors');
        if (displayError) {
          displayError.textContent = error ? error.message : '';
        }
      });

      return this.card;
    } catch (error) {
      console.error('Failed to create payment form:', error);
      throw error;
    }
  }

  // Handle form submission for embedded payments
  async handleFormSubmit(form, options = {}) {
    try {
      if (!this.stripe || !this.card) {
        throw new Error('Stripe or card element not initialized');
      }

      const { clientSecret, billingDetails = {} } = options;

      if (!clientSecret) {
        throw new Error('Client secret is required for payment confirmation');
      }

      const result = await this.stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: this.card,
          billing_details: billingDetails,
        }
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.paymentIntent;
    } catch (error) {
      console.error('Payment confirmation failed:', error);
      throw error;
    }
  }

  // Utility function to format price for display
  formatPrice(amount, currency = 'usd') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  }

  // Check if payment was successful (call on success page)
  getPaymentStatusFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      sessionId: urlParams.get('session_id'),
      paymentIntent: urlParams.get('payment_intent'),
      paymentIntentClientSecret: urlParams.get('payment_intent_client_secret'),
      redirectStatus: urlParams.get('redirect_status')
    };
  }

  // Retrieve checkout session details
  async getCheckoutSession(sessionId) {
    try {
      // Note: This would require adding an endpoint to your worker
      // that uses Stripe's retrieve session API
      const response = await fetch(`${this.workerUrl}/payments/session/${sessionId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve session');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to retrieve checkout session:', error);
      throw error;
    }
  }
}

// Predefined pricing tiers (customize these for your app)
const PRICING_TIERS = {
  basic: {
    name: 'Basic Plan',
    priceId: 'price_basic_monthly', // Replace with your actual Stripe price ID
    amount: 999, // $9.99 in cents
    currency: 'usd',
    interval: 'month',
    features: ['Feature 1', 'Feature 2', 'Feature 3']
  },
  pro: {
    name: 'Pro Plan',
    priceId: 'price_pro_monthly', // Replace with your actual Stripe price ID
    amount: 1999, // $19.99 in cents
    currency: 'usd',
    interval: 'month',
    features: ['All Basic features', 'Feature 4', 'Feature 5', 'Priority support']
  },
  premium: {
    name: 'Premium Plan',
    priceId: 'price_premium_monthly', // Replace with your actual Stripe price ID
    amount: 4999, // $49.99 in cents
    currency: 'usd',
    interval: 'month',
    features: ['All Pro features', 'Feature 6', 'Feature 7', 'Custom integrations']
  }
};

// Usage examples and helper functions
const PaymentHelpers = {
  // Create pricing display
  createPricingCard(tier, stripe) {
    const card = document.createElement('div');
    card.className = 'pricing-card';
    card.innerHTML = `
      <div class="pricing-header">
        <h3>${tier.name}</h3>
        <div class="price">${stripe.formatPrice(tier.amount, tier.currency)}/${tier.interval}</div>
      </div>
      <ul class="features">
        ${tier.features.map(feature => `<li>${feature}</li>`).join('')}
      </ul>
      <button class="subscribe-btn" data-price-id="${tier.priceId}">
        Subscribe Now
      </button>
    `;
    return card;
  },

  // Add event listeners for payment buttons
  initPaymentButtons(stripe) {
    document.addEventListener('click', async (e) => {
      if (e.target.classList.contains('subscribe-btn')) {
        e.preventDefault();
        const priceId = e.target.dataset.priceId;
        const button = e.target;
        
        try {
          button.disabled = true;
          button.textContent = 'Processing...';
          
          await stripe.createSubscription(priceId, {
            customerEmail: this.getCurrentUserEmail(), // Implement this
          });
        } catch (error) {
          alert('Payment failed: ' + error.message);
          button.disabled = false;
          button.textContent = 'Subscribe Now';
        }
      }
    });
  },

  // Get current user email (implement based on your auth system)
  getCurrentUserEmail() {
    // This should integrate with your auth system
    // For example, from a global user object or localStorage
    return window.currentUser?.email || null;
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StripePayments, PRICING_TIERS, PaymentHelpers };
} else {
  window.StripePayments = StripePayments;
  window.PRICING_TIERS = PRICING_TIERS;
  window.PaymentHelpers = PaymentHelpers;
}