// wallet.js - User Wallet & Payment Management
class UserWallet {
  constructor(workerUrl) {
    this.workerUrl = workerUrl;
    this.user = null;
    this.subscription = null;
    this.paymentHistory = [];
    this.credits = 0;
    this.isLoading = false;
  }

  // Initialize wallet with user session
  async init() {
    try {
      this.isLoading = true;
      await this.loadUserData();
      await this.loadSubscriptionStatus();
      await this.loadPaymentHistory();
      this.isLoading = false;
      this.updateWalletUI();
      return true;
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
      this.isLoading = false;
      return false;
    }
  }

  // Load current user data from auth
  async loadUserData() {
    try {
      const response = await fetch(`${this.workerUrl}/auth/verify`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${this.getSessionToken()}`,
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.user = data.user;
        return this.user;
      } else {
        throw new Error('User not authenticated');
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
      this.user = null;
      return null;
    }
  }

  // Get session token from localStorage or cookies
  getSessionToken() {
    // Try localStorage first
    let token = localStorage.getItem('session_token');
    
    // Fallback to cookies
    if (!token) {
      const cookies = document.cookie.split(';');
      const sessionCookie = cookies.find(cookie => 
        cookie.trim().startsWith('session_token=')
      );
      if (sessionCookie) {
        token = sessionCookie.split('=')[1];
      }
    }
    
    return token;
  }

  // Load subscription status (you'll need to add this endpoint to your worker)
  async loadSubscriptionStatus() {
    try {
      // This would require adding a subscription status endpoint to your worker
      const response = await fetch(`${this.workerUrl}/payments/subscription-status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getSessionToken()}`,
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.subscription = data.subscription;
        this.credits = data.credits || 0;
      }
    } catch (error) {
      console.error('Failed to load subscription status:', error);
      this.subscription = null;
    }
  }

  // Load payment history
  async loadPaymentHistory() {
    try {
      // This would require adding a payment history endpoint to your worker
      const response = await fetch(`${this.workerUrl}/payments/history`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getSessionToken()}`,
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.paymentHistory = data.payments || [];
      }
    } catch (error) {
      console.error('Failed to load payment history:', error);
      this.paymentHistory = [];
    }
  }

  // Purchase credits (one-time payment)
  async purchaseCredits(creditPackage) {
    try {
      const stripe = new StripePayments(this.workerUrl);
      await stripe.createCheckoutSession(creditPackage.priceId, {
        customerEmail: this.user?.email,
        successUrl: `${window.location.origin}/wallet?success=credits`,
        cancelUrl: `${window.location.origin}/wallet`,
        metadata: {
          type: 'credits',
          credits: creditPackage.credits.toString(),
          userId: this.user?.id
        }
      });
    } catch (error) {
      console.error('Failed to purchase credits:', error);
      throw error;
    }
  }

  // Subscribe to a plan
  async subscribeToPlan(planId) {
    try {
      const stripe = new StripePayments(this.workerUrl);
      await stripe.createSubscription(planId, {
        customerEmail: this.user?.email,
        successUrl: `${window.location.origin}/wallet?success=subscription`,
        cancelUrl: `${window.location.origin}/wallet`,
        metadata: {
          userId: this.user?.id
        }
      });
    } catch (error) {
      console.error('Failed to subscribe to plan:', error);
      throw error;
    }
  }

  // Cancel subscription
  async cancelSubscription() {
    try {
      // This would require adding a cancel subscription endpoint
      const response = await fetch(`${this.workerUrl}/payments/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getSessionToken()}`,
        },
        body: JSON.stringify({
          subscriptionId: this.subscription?.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      const result = await response.json();
      this.subscription = result.subscription;
      this.updateWalletUI();
      return result;
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  // Update payment method
  async updatePaymentMethod() {
    try {
      // This would create a Stripe setup session for updating payment methods
      const response = await fetch(`${this.workerUrl}/payments/update-payment-method`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getSessionToken()}`,
        }
      });

      if (!response.ok) {
        throw new Error('Failed to create payment method update session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Failed to update payment method:', error);
      throw error;
    }
  }

  // Use credits (deduct from user balance)
  async useCredits(amount, description = 'Service usage') {
    try {
      const response = await fetch(`${this.workerUrl}/payments/use-credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getSessionToken()}`,
        },
        body: JSON.stringify({
          amount,
          description
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to use credits');
      }

      const result = await response.json();
      this.credits = result.remainingCredits;
      this.updateWalletUI();
      return result;
    } catch (error) {
      console.error('Failed to use credits:', error);
      throw error;
    }
  }

  // Check if user has enough credits
  hasEnoughCredits(amount) {
    return this.credits >= amount;
  }

  // Get subscription status
  getSubscriptionStatus() {
    if (!this.subscription) return 'none';
    
    const now = new Date();
    const currentPeriodEnd = new Date(this.subscription.current_period_end * 1000);
    
    if (this.subscription.status === 'active' && now < currentPeriodEnd) {
      return 'active';
    } else if (this.subscription.status === 'canceled') {
      return 'canceled';
    } else if (this.subscription.status === 'past_due') {
      return 'past_due';
    } else {
      return 'inactive';
    }
  }

  // Format currency amounts
  formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100);
  }

  // Format date
  formatDate(timestamp) {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Update wallet UI
  updateWalletUI() {
    this.updateCreditsDisplay();
    this.updateSubscriptionDisplay();
    this.updatePaymentHistoryDisplay();
  }

  // Update credits display
  updateCreditsDisplay() {
    const creditsElement = document.getElementById('wallet-credits');
    if (creditsElement) {
      creditsElement.textContent = this.credits.toLocaleString();
    }

    const creditsContainer = document.getElementById('credits-container');
    if (creditsContainer) {
      creditsContainer.innerHTML = `
        <div class="credits-card">
          <h3>Available Credits</h3>
          <div class="credits-amount">${this.credits.toLocaleString()}</div>
          <p class="credits-description">Use credits for AI analysis and processing</p>
          <button id="buy-credits-btn" class="btn-primary">Buy More Credits</button>
        </div>
      `;
    }
  }

  // Update subscription display
  updateSubscriptionDisplay() {
    const subscriptionContainer = document.getElementById('subscription-container');
    if (!subscriptionContainer) return;

    const status = this.getSubscriptionStatus();
    
    if (status === 'active' && this.subscription) {
      subscriptionContainer.innerHTML = `
        <div class="subscription-card active">
          <h3>Current Subscription</h3>
          <div class="subscription-plan">${this.subscription.plan || 'Premium Plan'}</div>
          <div class="subscription-status">Status: Active</div>
          <div class="subscription-renewal">
            Next billing: ${this.formatDate(this.subscription.current_period_end)}
          </div>
          <div class="subscription-amount">
            ${this.formatCurrency(this.subscription.amount || 0)}/${this.subscription.interval || 'month'}
          </div>
          <div class="subscription-actions">
            <button id="update-payment-btn" class="btn-secondary">Update Payment Method</button>
            <button id="cancel-subscription-btn" class="btn-danger">Cancel Subscription</button>
          </div>
        </div>
      `;
    } else {
      subscriptionContainer.innerHTML = `
        <div class="subscription-card inactive">
          <h3>No Active Subscription</h3>
          <p>Subscribe to get unlimited credits and premium features</p>
          <button id="subscribe-btn" class="btn-primary">View Plans</button>
        </div>
      `;
    }
  }

  // Update payment history display
  updatePaymentHistoryDisplay() {
    const historyContainer = document.getElementById('payment-history-container');
    if (!historyContainer) return;

    if (this.paymentHistory.length === 0) {
      historyContainer.innerHTML = '<p>No payment history found.</p>';
      return;
    }

    const historyHTML = this.paymentHistory.map(payment => `
      <div class="payment-item">
        <div class="payment-info">
          <div class="payment-description">${payment.description || 'Payment'}</div>
          <div class="payment-date">${this.formatDate(payment.created)}</div>
        </div>
        <div class="payment-amount">${this.formatCurrency(payment.amount, payment.currency)}</div>
        <div class="payment-status status-${payment.status}">${payment.status}</div>
      </div>
    `).join('');

    historyContainer.innerHTML = `
      <div class="payment-history">
        <h3>Payment History</h3>
        <div class="payment-list">
          ${historyHTML}
        </div>
      </div>
    `;
  }

  // Initialize event listeners
  initEventListeners() {
    document.addEventListener('click', (e) => {
      if (e.target.id === 'buy-credits-btn') {
        this.showCreditPackages();
      } else if (e.target.id === 'subscribe-btn') {
        this.showSubscriptionPlans();
      } else if (e.target.id === 'cancel-subscription-btn') {
        this.handleCancelSubscription();
      } else if (e.target.id === 'update-payment-btn') {
        this.updatePaymentMethod();
      }
    });
  }

  // Show credit packages modal
  showCreditPackages() {
    const packages = [
      { credits: 100, price: 999, priceId: 'price_credits_100' },
      { credits: 500, price: 3999, priceId: 'price_credits_500' },
      { credits: 1000, price: 6999, priceId: 'price_credits_1000' }
    ];

    const modal = this.createModal('Buy Credits', packages.map(pkg => `
      <div class="credit-package" data-price-id="${pkg.priceId}" data-credits="${pkg.credits}">
        <h4>${pkg.credits} Credits</h4>
        <div class="package-price">${this.formatCurrency(pkg.price)}</div>
        <button class="btn-primary buy-package-btn">Purchase</button>
      </div>
    `).join(''));

    modal.addEventListener('click', async (e) => {
      if (e.target.classList.contains('buy-package-btn')) {
        const package = e.target.closest('.credit-package');
        const priceId = package.dataset.priceId;
        const credits = parseInt(package.dataset.credits);
        
        try {
          await this.purchaseCredits({ priceId, credits });
        } catch (error) {
          alert('Failed to purchase credits: ' + error.message);
        }
      }
    });
  }

  // Show subscription plans modal
  showSubscriptionPlans() {
    window.location.href = '/pricing'; // Redirect to pricing page
  }

  // Handle subscription cancellation
  async handleCancelSubscription() {
    if (confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
      try {
        await this.cancelSubscription();
        alert('Subscription cancelled successfully.');
      } catch (error) {
        alert('Failed to cancel subscription: ' + error.message);
      }
    }
  }

  // Create modal utility
  createModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-content">
          ${content}
        </div>
      </div>
    `;

    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
        modal.remove();
      }
    });

    document.body.appendChild(modal);
    return modal;
  }
}

// Credit packages configuration
const CREDIT_PACKAGES = [
  {
    id: 'starter',
    credits: 100,
    price: 999, // $9.99 in cents
    priceId: 'price_credits_starter',
    popular: false,
    description: 'Perfect for trying out our services'
  },
  {
    id: 'popular',
    credits: 500,
    price: 3999, // $39.99 in cents
    priceId: 'price_credits_popular',
    popular: true,
    description: 'Most popular choice for regular users'
  },
  {
    id: 'bulk',
    credits: 1000,
    price: 6999, // $69.99 in cents
    priceId: 'price_credits_bulk',
    popular: false,
    description: 'Best value for power users'
  }
];

// Utility functions
const WalletUtils = {
  // Check URL parameters for payment success/failure
  checkPaymentStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const sessionId = urlParams.get('session_id');

    if (success === 'credits' && sessionId) {
      this.showPaymentSuccess('Credits purchased successfully!');
    } else if (success === 'subscription' && sessionId) {
      this.showPaymentSuccess('Subscription activated successfully!');
    }

    // Clean up URL
    if (success || sessionId) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  },

  // Show payment success message
  showPaymentSuccess(message) {
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 5000);
  },

  // Initialize wallet page
  async initWalletPage(workerUrl) {
    const wallet = new UserWallet(workerUrl);
    await wallet.init();
    wallet.initEventListeners();
    this.checkPaymentStatus();
    return wallet;
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UserWallet, CREDIT_PACKAGES, WalletUtils };
} else {
  window.UserWallet = UserWallet;
  window.CREDIT_PACKAGES = CREDIT_PACKAGES;
  window.WalletUtils = WalletUtils;
}