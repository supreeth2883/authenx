import { applyDecorators, SetMetadata } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';

/**
 * Rate limit tiers for different endpoint types
 */

// Public endpoints: 100 req/min
export const ThrottlePublic = () =>
  applyDecorators(
    Throttle({ default: { ttl: 60000, limit: 100 } }),
    SetMetadata('throttle-tier', 'public'),
  );

// Verification endpoints: 20 req/min
export const ThrottleVerify = () =>
  applyDecorators(
    Throttle({ default: { ttl: 60000, limit: 20 } }),
    SetMetadata('throttle-tier', 'verify'),
  );

// Auth endpoints: 5 req/min (brute force protection)
export const ThrottleAuth = () =>
  applyDecorators(
    Throttle({ default: { ttl: 60000, limit: 5 } }),
    SetMetadata('throttle-tier', 'auth'),
  );

// Skip throttling (for internal/health endpoints)
export const NoThrottle = () => SkipThrottle();
