import { ClientManager } from './ClientManager'
import { createLogger } from '@cryptovoxels/app-basics'
const fetch = require('node-fetch')
const eth_app_id = process.env.ETH_APP_ID
const polygon_app_id = process.env.POLYGON_APP_ID

import { Policy } from 'cockatiel'
import { orderBy } from 'lodash'

import { headers, udpateWebhookAddresses } from './lib/helper'

const log = createLogger('HOOKManager')
// Create a retry policy that'll retry whatever function we execute two more times with a randomized exponential backoff if it throws
const retry = Policy.handleAll().retry().attempts(2).exponential()
retry.onRetry((reason) => log.debug(`retrying a function call, delaying ${reason.delay.toFixed(1)}ms`))
const POLYGON_ID = 'MATIC_MAINNET'
const ETH_ID = 'ETH_MAINNET'
const SUPPORTED_CHAINS:HookNetwork[] = [ETH_ID, POLYGON_ID]
type HookNetwork = 'MATIC_MAINNET'|'ETH_MAINNET'
type hook = { webhook_url: string; app_id: string; version:string; network:HookNetwork,webhook_type:string,is_active: boolean; addresses?: string[] }

type hookReceived = hook & { id: string }
type hookLocal = hook & { id: string }

type hookIdOnly = { id: string }

export default class WebhookManager {
  // webhook per chainId 1:ETH_MAINNET 137:MATIC_MAINNET
  webhook_ids: Map<HookNetwork, string | undefined> = new Map()
  queues: Map<HookNetwork, string[]> = new Map()
  clientManager?: ClientManager
  constructor(clientManager?: ClientManager) {
    this.clientManager = clientManager
    this.queues.set(ETH_ID, [])
    this.queues.set(POLYGON_ID, [])
  }

  async init() {
    await retry.execute(async () => await this.getRemoteHooks())
    for (const chain_id of SUPPORTED_CHAINS) {
      await this.create(chain_id as HookNetwork)
    }
  }

  getRemoteHooks = async () => {
    let p
    try {
      p = await fetch(`https://dashboard.alchemyapi.io/api/team-webhooks`, { method: 'GET', headers })
    } catch (e) {
      log.error(e)
      return null
    }

    if (!p) {
      return null
    }
    let r
    try {
      r = (await p.json()) as { data: hookReceived[] }
    } catch {
      throw Error('bad JSON')
    }
    console.log(r.data)

    if (!r?.data || !r?.data?.length) {
      return null
    }
    const hooks = r.data.filter((d) => d.webhook_url === `https://notifier.crvox.com/hook`)

    const eth_hooks = r.data.filter((d) => d.network=='ETH_MAINNET')
    const polygon_hooks = r.data.filter((d) => d.network=='MATIC_MAINNET')

    if (!eth_hooks.length) {
      if (this.webhook_ids.has(ETH_ID)) {
        this.webhook_ids.delete(ETH_ID)
      }
    }
    if (!polygon_hooks.length) {
      if (this.webhook_ids.has(POLYGON_ID)) {
        this.webhook_ids.delete(POLYGON_ID)
      }
    }

    if (!polygon_hooks.length && !eth_hooks.length) {
      return null
    }

    log.info(`Found ${hooks.length} hooks;`)
    // find hook with most addresses in it;
    let hooksToRemove: hookReceived[] = []

    if (eth_hooks.length) {
      let orderedHooks = orderBy(
        eth_hooks,
        [
          function (o:hook) {
            return o.addresses?.length || 0
          },
        ],
        ['desc']
      )

      this.setWebHookId(orderedHooks[0]as hookReceived, 'ETH_MAINNET') // eth chain
      orderedHooks.splice(0, 1)
      hooksToRemove.push(...orderedHooks as hookReceived[])
    }

    if (polygon_hooks.length) {
      let orderedHooks = orderBy(
        polygon_hooks,
        [
          function (o:hook) {
            return o.addresses?.length || 0
          },
        ],
        ['desc']
      )

      this.setWebHookId(orderedHooks[0]as hookReceived, 'MATIC_MAINNET') // eth chain
      orderedHooks.splice(0, 1)
      hooksToRemove.push(...orderedHooks as hookReceived[])
    }

    // Delete all remote hooks that we want to discard
    for (const hook of hooksToRemove) {
      WebhookManager.removeHook(hook)
    }
    return true
  }

  setWebHookId = async (hook: hookReceived, chain: HookNetwork = 'ETH_MAINNET') => {
    this.webhook_ids.set(chain, hook.id)

    log.info(`Current webhook: ${hook.id}`)
    // on set webhook; go through the queue of addresses
    let a = Array.from(this.queues.get(chain) || [])
    let p = await this.addWalletsToChain(a, chain)
    if (!p) {
      this.queues.set(chain, a)
    } else {
      this.queues.set(chain, [])
    }
  }

  create = async (chain:HookNetwork = 'ETH_MAINNET') => {
    if (this.webhook_ids.has(chain)) {
      return
    }
    const body = JSON.stringify({
      app_id: chain == 'ETH_MAINNET' ? eth_app_id : polygon_app_id,
      network:chain,
      webhook_type: 'ADDRESS_ACTIVITY', //activity webhook
      webhook_url: `https://notifier.crvox.com/hook`,
      addresses: this.clientManager?.clients.length?this.clientManager?.clients.map((c) => c.wallet) : [],
    })

    let p
    try {
      p = await fetch(`https://dashboard.alchemyapi.io/api/create-webhook`, { method: 'POST', headers, body })
    } catch (e) {
      log.error(e)
      return false
    }

    if (!p) {
      return false
    }

    let r
    try {
      r = (await p.json()) as { data: hookReceived }
    } catch(e) {
      console.log(e)
      return false
    }

    if (r.data && r.data.is_active) {
      log.info(`Webhook ${r.data.id} created`)
      await this.setWebHookId(r.data,chain)
      return true
    }
    return false
  }

  update = async (chain: HookNetwork= 'ETH_MAINNET') => {
    if (!this.webhook_ids.has(chain)) {
      throw Error('update: no webhook_id')
    }
    const body = JSON.stringify({
      webhook_id: this.webhook_ids.get(chain),
      addresses: this.clientManager?.clients.map((c) => c.wallet) || [],
    })

    let p
    try {
      p = await fetch(`https://dashboard.alchemyapi.io/api/update-webhook-addresses`, { method: 'PUT', headers: headers as any, body: body as any })
    } catch (e) {
      console.error(e)
      return false
    }

    let r = await p.json()

    if (r) {
      return true
    }
    return false
  }

  addWalletsToChain = async (wallets: string | string[], chain_id: HookNetwork) => {
    let walletsToAdd = wallets
    if (typeof wallets == 'string') {
      walletsToAdd = [wallets]
    }

    const Wid = this.webhook_ids.get(chain_id)
    if (!Wid) {
      this.queues.set(chain_id, [...walletsToAdd, ...(this.queues.get(chain_id) || [])])
      log.warn(`addWallet: no webhook_id for ${chain_id}; saving to queue`)
      return false
    }

    if (!walletsToAdd.length) {
      return false
    }

    const body = {
      webhook_id: Wid,
      addresses_to_add: [...walletsToAdd],
      addresses_to_remove: [],
    }

    return await udpateWebhookAddresses(body)
  }

  addWalletsToAllChains = async (wallets: string | string[]) => {
    let walletsToAdd = wallets
    if (typeof wallets == 'string') {
      walletsToAdd = [wallets]
    }

    let success: Record<HookNetwork, boolean> = { 'ETH_MAINNET': false, 'MATIC_MAINNET': false }

    for (const chain_id of SUPPORTED_CHAINS) {
      let Wid = this.webhook_ids.get(chain_id)

      if (!Wid) {
        this.queues.set(chain_id, [...walletsToAdd, ...(this.queues.get(chain_id) || [])])
        log.warn(`addWallet: no webhook_id for ${chain_id}; saving to queue`)
        success[chain_id] = false
        continue
      }

      if (!walletsToAdd.length) {
        success[chain_id] = false
        continue
      }

      const body = {
        webhook_id: Wid,
        addresses_to_add: [...walletsToAdd],
        addresses_to_remove: [],
      }

      let p = await udpateWebhookAddresses(body)
      if (!p) {
        success[chain_id] = false
        continue
      } else {
        log.info(`wallet ${JSON.stringify(wallets)} added`)
        success[chain_id] = true
      }
    }
    return success
  }

  removeWallet = async (wallet: string) => {
    let success = false
    for (const chain_id of SUPPORTED_CHAINS) {
      if (!this.webhook_ids.has(chain_id)) {
        log.error('removeWallet: No webhook_id found')
        success = false
        continue
      }

      const body = JSON.stringify({
        webhook_id: this.webhook_ids.get(chain_id),
        addresses_to_add: [],
        addresses_to_remove: [wallet],
      })

      const sendRemoveWallet = async () => {
        let p
        try {
          p = await fetch(`https://dashboard.alchemyapi.io/api/update-webhook-addresses`, { method: 'PATCH', headers, body })
        } catch (e) {
          throw new Error('fetch error: Could not reach')
        }
        let r
        try {
          r = await p.json()
        } catch (e) {
          throw new Error('fetch Error: bad JSON')
        }
        return true
      }

      await retry.execute(async () => await sendRemoveWallet())

      success = true
    }
    return success
  }

  clean = () => {
    for (const chain_id of SUPPORTED_CHAINS) {
      let Wid = this.webhook_ids.get(chain_id)
      if (!!Wid) {
        WebhookManager.removeHook({ id: Wid })
      }
    }
  }

  static removeHook = async (hook: hookIdOnly) => {
    if (!hook) {
      return
    }

    let p
    try {
      p = await fetch(`https://dashboard.alchemyapi.io/api/delete-webhook?=${hook.id}`, { method: 'DELETE', headers })
    } catch (e) {
      log.error(e)
      return false
    }

    if (!p) {
      return false
    }
    let r = (await p.json()) as {}

    if (r) {
      log.info(`removed Hook ${hook.id}`)
      return true
    }
    return false
  }
}
