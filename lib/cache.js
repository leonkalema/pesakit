const NodeCache = require('node-cache');
const crypto = require('crypto');
const { ConfigurationError } = require('./errors');

/**
 * Secure token cache with encryption and TTL management
 */
class SecureCache {
  constructor(options = {}) {
    const {
      stdTTL = 3300, // 55 minutes (tokens expire in 1 hour)
      checkperiod = 600, // Check for expired keys every 10 minutes
      useClones = false,
      deleteOnExpire = true,
      encryptionKey = null
    } = options;

    this.cache = new NodeCache({
      stdTTL,
      checkperiod,
      useClones,
      deleteOnExpire
    });

    // Generate encryption key if not provided
    this.encryptionKey = encryptionKey || this.generateEncryptionKey();
    
    // Bind event handlers
    this.cache.on('expired', this.handleExpired.bind(this));
    this.cache.on('del', this.handleDelete.bind(this));
  }

  generateEncryptionKey() {
    return crypto.randomBytes(32);
  }

  encrypt(text) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      throw new ConfigurationError('Failed to encrypt data', { error: error.message });
    }
  }

  decrypt(encryptedText) {
    try {
      const [ivHex, encrypted] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new ConfigurationError('Failed to decrypt data', { error: error.message });
    }
  }

  set(key, value, ttl = null) {
    try {
      const encryptedValue = this.encrypt(JSON.stringify(value));
      const success = this.cache.set(key, encryptedValue, ttl);
      
      if (!success) {
        throw new ConfigurationError('Failed to store value in cache');
      }
      
      return success;
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError('Cache set operation failed', { error: error.message });
    }
  }

  get(key) {
    try {
      const encryptedValue = this.cache.get(key);
      
      if (encryptedValue === undefined) {
        return undefined;
      }
      
      const decryptedValue = this.decrypt(encryptedValue);
      return JSON.parse(decryptedValue);
    } catch (error) {
      // If decryption fails, remove the corrupted entry
      this.cache.del(key);
      return undefined;
    }
  }

  has(key) {
    return this.cache.has(key);
  }

  del(key) {
    return this.cache.del(key);
  }

  clear() {
    this.cache.flushAll();
  }

  keys() {
    return this.cache.keys();
  }

  getStats() {
    return this.cache.getStats();
  }

  getTtl(key) {
    return this.cache.getTtl(key);
  }

  // Event handlers
  handleExpired(key, value) {
    // Log token expiration for monitoring
    console.debug(`Cache key expired: ${key}`);
  }

  handleDelete(key, value) {
    // Log token deletion for monitoring
    console.debug(`Cache key deleted: ${key}`);
  }

  // Health check method
  healthCheck() {
    try {
      const testKey = '__health_check__';
      const testValue = { timestamp: Date.now() };
      
      this.set(testKey, testValue, 1); // 1 second TTL
      const retrieved = this.get(testKey);
      
      if (!retrieved || retrieved.timestamp !== testValue.timestamp) {
        throw new Error('Cache health check failed');
      }
      
      this.del(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Token-specific cache with additional security measures
 */
class TokenCache extends SecureCache {
  constructor(options = {}) {
    super({
      ...options,
      stdTTL: 3300 // 55 minutes for OAuth tokens
    });
  }

  setToken(consumerKey, token, expiresIn = 3600) {
    const tokenData = {
      token,
      issuedAt: Date.now(),
      expiresAt: Date.now() + (expiresIn * 1000),
      consumerKey: this.hashConsumerKey(consumerKey)
    };

    // Set TTL to 55 minutes to ensure refresh before expiration
    const ttl = Math.max(300, expiresIn - 300); // At least 5 minutes, but 5 minutes before expiration
    
    return this.set(this.getTokenKey(consumerKey), tokenData, ttl);
  }

  getToken(consumerKey) {
    const tokenData = this.get(this.getTokenKey(consumerKey));
    
    if (!tokenData) {
      return null;
    }

    // Verify the token hasn't expired
    if (Date.now() >= tokenData.expiresAt) {
      this.del(this.getTokenKey(consumerKey));
      return null;
    }

    // Verify the consumer key matches
    if (tokenData.consumerKey !== this.hashConsumerKey(consumerKey)) {
      this.del(this.getTokenKey(consumerKey));
      return null;
    }

    return tokenData.token;
  }

  invalidateToken(consumerKey) {
    return this.del(this.getTokenKey(consumerKey));
  }

  getTokenKey(consumerKey) {
    return `token:${this.hashConsumerKey(consumerKey)}`;
  }

  hashConsumerKey(consumerKey) {
    return crypto.createHash('sha256').update(consumerKey).digest('hex');
  }

  // Get token metadata without exposing the actual token
  getTokenMetadata(consumerKey) {
    const tokenData = this.get(this.getTokenKey(consumerKey));
    
    if (!tokenData) {
      return null;
    }

    return {
      issuedAt: tokenData.issuedAt,
      expiresAt: tokenData.expiresAt,
      timeToExpiry: tokenData.expiresAt - Date.now(),
      isValid: Date.now() < tokenData.expiresAt
    };
  }
}

module.exports = {
  SecureCache,
  TokenCache
};
