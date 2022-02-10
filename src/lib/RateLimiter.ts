export type RateLimiter = {
  tryConsume(ipAddr: string): Promise<true | RateLimitation>
  canConsume(ipAddr: string): Promise<true | RateLimitation>
  reset(ipAddr: string): Promise<void>
}

export type RateLimitation = {
  msBeforeNext: number
}
