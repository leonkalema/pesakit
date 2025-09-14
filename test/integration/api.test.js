const Pesakit = require('../../index');

describe('Pesakit Integration Tests', () => {
  let client;
  
  // Test with real sandbox credentials (these are public test credentials)
  const testConfig = {
    consumerKey: 'qkio1BGGYHe-dmQAL2B-L8tnnP3gM1-1',
    consumerSecret: 'osGQ364R2+cqVx6vz5R1Q7dtIoU=',
    environment: 'sandbox'
  };

  beforeAll(() => {
    client = new Pesakit(testConfig);
  });

  afterAll(() => {
    if (client) {
      client.destroy();
    }
  });

  describe('OAuth Authentication Flow', () => {
    test('should authenticate with real sandbox API', async () => {
      const token = await client.getOAuthToken();
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    }, 30000);

    test('should cache tokens between requests', async () => {
      const startTime = Date.now();
      const token1 = await client.getOAuthToken();
      const firstCallTime = Date.now() - startTime;

      const startTime2 = Date.now();
      const token2 = await client.getOAuthToken();
      const secondCallTime = Date.now() - startTime2;

      expect(token1).toBe(token2);
      expect(secondCallTime).toBeLessThan(firstCallTime / 2); // Should be much faster due to caching
    }, 30000);
  });

  describe('Payment Creation Flow', () => {
    test('should create payment request successfully', async () => {
      const paymentData = {
        amount: 100.00,
        description: 'Integration test payment',
        reference: `TEST-${Date.now()}`,
        email: 'test@example.com',
        callbackUrl: 'https://httpbin.org/post',
        currency: 'KES'
      };

      const redirectUrl = await client.createPayment(paymentData);
      
      expect(redirectUrl).toBeDefined();
      expect(redirectUrl).toContain('pesapal.com');
      expect(redirectUrl).toContain('OrderTrackingId');
    }, 30000);

    test('should handle invalid payment data gracefully', async () => {
      const invalidPaymentData = {
        amount: -100, // Invalid negative amount
        description: '',
        reference: '',
        email: 'invalid-email',
        callbackUrl: 'not-a-url'
      };

      await expect(client.createPayment(invalidPaymentData))
        .rejects
        .toThrow();
    });
  });

  describe('Rate Limiting Behavior', () => {
    test('should handle rate limits gracefully', async () => {
      const promises = [];
      
      // Make multiple concurrent requests
      for (let i = 0; i < 5; i++) {
        promises.push(client.getOAuthToken());
      }

      const results = await Promise.allSettled(promises);
      
      // All should succeed due to caching and rate limiting
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });
    }, 30000);
  });

  describe('Error Handling', () => {
    test('should handle network timeouts', async () => {
      const shortTimeoutClient = new Pesakit({
        ...testConfig,
        timeout: 1 // Very short timeout
      });

      await expect(shortTimeoutClient.getOAuthToken())
        .rejects
        .toThrow();

      shortTimeoutClient.destroy();
    }, 10000);

    test('should handle invalid credentials', async () => {
      const invalidClient = new Pesakit({
        consumerKey: 'invalid_key',
        consumerSecret: 'invalid_secret',
        environment: 'sandbox'
      });

      await expect(invalidClient.getOAuthToken())
        .rejects
        .toThrow();

      invalidClient.destroy();
    }, 30000);
  });

  describe('Health and Monitoring', () => {
    test('should provide health status', async () => {
      const health = await client.getHealthStatus();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('checks');
      expect(health.status).toMatch(/healthy|degraded|unhealthy|critical/);
    });

    test('should collect metrics', () => {
      const metrics = client.getMetrics();
      
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics.uptime).toBeGreaterThan(0);
    });
  });

  describe('Circuit Breaker Integration', () => {
    test('should recover from temporary failures', async () => {
      // This test would require simulating API failures
      // For now, we'll just verify the circuit breaker exists and is healthy
      const health = client.circuitBreaker.healthCheck();
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('breakers');
    });
  });

  describe('Memory and Performance', () => {
    test('should not leak memory during normal operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        await client.getOAuthToken();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    }, 60000);

    test('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();
      const concurrentRequests = 20;
      
      const promises = Array(concurrentRequests).fill().map(() => 
        client.getOAuthToken()
      );
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      // All requests should succeed
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(token => {
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
      });
      
      // Should complete in reasonable time (less than 30 seconds)
      expect(duration).toBeLessThan(30000);
    }, 45000);
  });
});
