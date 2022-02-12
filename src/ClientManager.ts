

import { Client } from './client'
import { ClientChannel } from './lib/ClientChannel'
import { RateLimiter } from './lib/RateLimiter'
import {createLogger } from '@cryptovoxels/app-basics'
import WebhookManager from './WebHookManager'
const log =createLogger()

export type AddClientResult =
  | {
      kind: 'success'
      client: Client
    }
  | {
      kind: 'error'
      reason: 'loginFailureRateLimit'
    }

export class ClientManager {
  clients: Client[] = []
  webhookManager: WebhookManager
  constructor(
    private readonly jwtSecret: string,
    private readonly loginRateLimiter: RateLimiter,
  ) {
    this.webhookManager = new WebhookManager(this)
  }

  async addClient(channel: ClientChannel, ipAddr: string): Promise<AddClientResult> {
    if ((await this.loginRateLimiter.canConsume(ipAddr)) !== true) {
      return {
        kind: 'error',
        reason: 'loginFailureRateLimit',
      }
    }

    const client = new Client(this.jwtSecret, channel, this,ipAddr)
    this.clients.push(client)
    return {
      kind: 'success',
      client,
    }
  }

  async failedLogin(ipAddr: string) {
    const rateLimitResult = await this.loginRateLimiter.tryConsume(ipAddr)
    if (rateLimitResult !== true) {
      log.info(`too many failed logins for ${ipAddr}, blocked for ${rateLimitResult.msBeforeNext / 1000} seconds`)
    }
  }

  async successfulLogin(ipAddr: string) {
    await this.loginRateLimiter.reset(ipAddr)
  }

  removeClient(c: any) {
    let i = this.clients.indexOf(c)
    if (i > -1) {
      this.clients.splice(i, 1)
    }
  }

  clientHasUniqueWallet(c:Client){
    return this.clients.filter((client)=>client.wallet.toLowerCase()==c.wallet.toLowerCase()).length<=1
  }

  removeInactiveClients() {
    log.debug('checking for inactive clients')
    this.clients.forEach((client) => {
      if (client.isActive()) {
        return
      }
      client.drop(1013, 'inactive')
      log.debug(`dropped inactive client ${client.wallet}`)
    })
  }

  dispose() {
    
  }
}
