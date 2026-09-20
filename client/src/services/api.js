// client/src/services/api.js
// Centralized HTTP client with JWT injection, transparent token rotation, error handling, and toast event bus

class ApiService {
  constructor() {
    let initialToken = null;
    let initialRefreshToken = null;

    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        if (urlToken) {
          localStorage.setItem('swifttrack_token', urlToken);
          initialToken = urlToken;
        } else {
          initialToken = localStorage.getItem('swifttrack_token');
        }
        initialRefreshToken = localStorage.getItem('swifttrack_refresh_token');
      } catch {
        initialToken = null;
        initialRefreshToken = null;
      }
    }

    this.token = initialToken;
    this.refreshToken = initialRefreshToken;
    this.isRefreshing = false;
    this.refreshSubscribers = [];
    this.toastListeners = new Set();
  }

  setToken(token) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('swifttrack_token', token);
      } else {
        localStorage.removeItem('swifttrack_token');
      }
    }
  }

  setRefreshToken(refreshToken) {
    this.refreshToken = refreshToken;
    if (typeof window !== 'undefined') {
      if (refreshToken) {
        localStorage.setItem('swifttrack_refresh_token', refreshToken);
      } else {
        localStorage.removeItem('swifttrack_refresh_token');
      }
    }
  }

  clearAuth() {
    this.setToken(null);
    this.setRefreshToken(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('swifttrack:auth_cleared'));
    }
  }

  onToast(listener) {
    this.toastListeners.add(listener);
    return () => this.toastListeners.delete(listener);
  }

  toast(message, type = 'info') {
    this.toastListeners.forEach(listener => listener({ message, type, id: Date.now() + Math.random() }));
  }

  formatKES(amount) {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  }

  formatCompactKES(amount) {
    const num = Number(amount) || 0;
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);
    if (abs >= 1_000_000_000) {
      return `${sign}Ksh ${(abs / 1_000_000_000).toFixed(2)}B`;
    }
    if (abs >= 1_000_000) {
      return `${sign}Ksh ${(abs / 1_000_000).toFixed(2)}M`;
    }
    if (abs >= 100_000) {
      return `${sign}Ksh ${(abs / 1_000).toFixed(1)}k`;
    }
    return this.formatKES(num);
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.token) {
      this.clearAuth();
      throw new Error(data?.error || 'Session renewal failed');
    }

    this.setToken(data.token);
    if (data.refreshToken) {
      this.setRefreshToken(data.refreshToken);
    }

    return data.token;
  }

  async request(endpoint, options = {}, isRetry = false) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.headers || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const res = await fetch(endpoint, {
        ...options,
        headers,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // Handle 401 Session Expiration and attempt transparent background refresh
        const isAuthRoute = endpoint.includes('/api/auth/login') ||
                            endpoint.includes('/api/auth/refresh') ||
                            endpoint.includes('/api/auth/logout') ||
                            endpoint.includes('/api/auth/2fa');

        if (res.status === 401 && !isAuthRoute && !isRetry && this.refreshToken) {
          try {
            if (!this.isRefreshing) {
              this.isRefreshing = true;
              const newToken = await this.refreshAccessToken();
              this.isRefreshing = false;
              this.refreshSubscribers.forEach(cb => cb(newToken));
              this.refreshSubscribers = [];
              return this.request(endpoint, options, true);
            } else {
              // Wait for existing refresh to resolve
              return new Promise((resolve, reject) => {
                this.refreshSubscribers.push((newToken) => {
                  this.request(endpoint, options, true).then(resolve).catch(reject);
                });
              });
            }
          } catch (refreshErr) {
            this.isRefreshing = false;
            this.refreshSubscribers = [];
            this.clearAuth();
            this.toast('Session expired. Please log in again.', 'error');
            throw new Error('Session expired');
          }
        }

        const errorMsg = data?.error || data?.message || `HTTP ${res.status}: Request failed`;
        const err = new Error(errorMsg);
        err.status = res.status;
        err.code = data?.code;
        err.mustChangePassword = data?.mustChangePassword;
        err.remainingMinutes = data?.remainingMinutes;
        err.remainingAttempts = data?.remainingAttempts;
        throw err;
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err.message);
      throw err;
    }
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  patch(endpoint, body) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiService();
