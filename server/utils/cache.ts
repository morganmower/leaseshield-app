/**
 * Simple in-memory cache with TTL (Time To Live)
 * For production, consider using Redis or similar
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class SimpleCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private defaultTTL: number;

  constructor(defaultTTLSeconds: number = 300) {
    this.cache = new Map();
    this.defaultTTL = defaultTTLSeconds * 1000; // Convert to milliseconds

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set a value in cache with optional custom TTL
   */
  set(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL;
    
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Delete a specific key from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = this.get(key);
    
    if (cached !== null) {
      return cached;
    }

    const value = await fetchFn();
    this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

/**
 * Cache instances for different data types
 */

// Cache for state data (rarely changes) - 1 hour TTL
export const stateCache = new SimpleCache<any>(3600);

// Cache for templates (changes occasionally) - 5 minutes TTL
export const templateCache = new SimpleCache<any>(300);

// Cache for compliance cards (changes occasionally) - 5 minutes TTL
export const complianceCache = new SimpleCache<any>(300);

// Cache for legal updates (changes frequently) - 1 minute TTL
export const legalUpdateCache = new SimpleCache<any>(60);

/**
 * Helper to invalidate related caches
 */
export function invalidateCache(type: 'state' | 'template' | 'compliance' | 'legal-update' | 'all'): void {
  switch (type) {
    case 'state':
      stateCache.clear();
      break;
    case 'template':
      templateCache.clear();
      break;
    case 'compliance':
      complianceCache.clear();
      break;
    case 'legal-update':
      legalUpdateCache.clear();
      break;
    case 'all':
      stateCache.clear();
      templateCache.clear();
      complianceCache.clear();
      legalUpdateCache.clear();
      break;
  }
}

/**
 * Memoize function results with cache
 */
export function memoize<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  cache: SimpleCache<any>,
  keyFn: (...args: Parameters<T>) => string,
  ttlSeconds?: number
): T {
  return (async (...args: Parameters<T>) => {
    const key = keyFn(...args);
    return cache.getOrSet(key, () => fn(...args), ttlSeconds);
  }) as T;
}

