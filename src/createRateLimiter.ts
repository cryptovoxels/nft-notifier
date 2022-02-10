import { IRateLimiterOptions, RateLimiterMemory } from 'rate-limiter-flexible'
import { RateLimitation, RateLimiter } from './lib/RateLimiter'

const RATE_LIMIT = process.env.RATE_LIMIT !== 'false'

const NOOP_RATE_LIMITER: RateLimiter = {
  tryConsume: async () => true,
  canConsume: async () => true,
  reset: async () => {},
}

export const createRateLimiter = (opts: IRateLimiterOptions): RateLimiter => {
  if (!RATE_LIMIT) {
    return NOOP_RATE_LIMITER
  }

  const rateLimiter = new RateLimiterMemory(opts)

  return {
    tryConsume: (ipAddr) =>
      rateLimiter
        .consume(ipAddr)
        .then(() => true as const)
        .catch((rl): RateLimitation => rl),
    canConsume: async (ipAddr) => {
      const rl = await rateLimiter.get(ipAddr)
      return rl !== null && rl.remainingPoints <= 0 ? rl : true
    },
    reset: async (ipAddr) => {
      await rateLimiter.delete(ipAddr)
    },
  }
}
