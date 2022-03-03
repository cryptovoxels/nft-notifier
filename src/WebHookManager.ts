import { ClientManager } from './ClientManager'
import { createLogger } from '@cryptovoxels/app-basics'
const fetch = require('node-fetch')
const eth_app_id = process.env.ETH_APP_ID
const polygon_app_id = process.env.POLYGON_APP_ID

import { Policy } from 'cockatiel'
import { orderBy } from 'lodash'

import {headers, udpateWebhookAddresses} from './lib/helper'

const log = createLogger('HOOKManager')
// Create a retry policy that'll retry whatever function we execute two more times with a randomized exponential backoff if it throws
const retry = Policy.handleAll().retry().attempts(2).exponential()
retry.onRetry((reason) => log.debug(`retrying a function call, delaying ${reason.delay.toFixed(1)}ms`))

type hook = { webhook_url: string; app_id: string; is_active: boolean; addresses?: string[] }

type hookReceived = hook &{id: number|string}
type hookLocal = hook &{id: string}

type hookIdOnly = { id: number |string }

const POLYGON_ID = 137
const ETH_ID = 1
const SUPPORTED_CHAINS = [ETH_ID,POLYGON_ID]
export default class WebhookManager {
  // webhook per chainId 1:eth 137:polygon
  webhook_ids: Map<number, number|string| undefined> = new Map()
  queues:Map<number, string[]>= new Map()
  clientManager?: ClientManager
  constructor(clientManager?: ClientManager) {
    this.clientManager = clientManager
    this.queues.set(ETH_ID,[])
    this.queues.set(POLYGON_ID,[])
  }

  async init() {
    await retry.execute(async () => await this.getRemoteHooks())
    for(const chain_id of SUPPORTED_CHAINS){
      console.log(chain_id)
      await this.create(chain_id as any)
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

    const eth_hooks = r.data.filter((d) => (d.app_id || '').toLowerCase() === eth_app_id?.toLowerCase())
    const polygon_hooks = r.data.filter((d) => (d.app_id || '').toLowerCase() === polygon_app_id?.toLowerCase() || !d.app_id)

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
          function (o) {
            return o.addresses?.length || 0
          },
        ],
        ['desc']
      )

      this.setWebHookId(orderedHooks[0], 1) // eth chain
      orderedHooks.splice(0, 1)
      hooksToRemove.push(...orderedHooks)
    }

    if (polygon_hooks.length) {
      let orderedHooks = orderBy(
        polygon_hooks,
        [
          function (o) {
            return o.addresses?.length || 0
          },
        ],
        ['desc']
      )

      this.setWebHookId(orderedHooks[0], 137) // eth chain
      orderedHooks.splice(0, 1)
      hooksToRemove.push(...orderedHooks)
    }

    // Delete all remote hooks that we want to discard
    for (const hook of hooksToRemove) {
      WebhookManager.removeHook(hook)
    }
    return true
  }

  setWebHookId = async (hook: hookReceived, chain: 1 | 137 = 1) => {
    this.webhook_ids.set(chain,hook.id)

    log.info(`Current webhook: ${hook.id}`)
    // on set webhook; go through the queue of addresses
    let a = Array.from(this.queues.get(chain)||[])
    let p = await this.addWalletsToChain(a,chain)
    if (!p) {
      this.queues.set(chain,a)
    } else {
      this.queues.set(chain,[])
    }
  }

  create = async (chain:1|137=1) => {
    if (this.webhook_ids.has(chain)) {
      return
    }
    const body = JSON.stringify({
      app_id:chain==1?eth_app_id:polygon_app_id,
      webhook_type: 4, //activity webhook
      webhook_url: `https://notifier.crvox.com/hook`,
      addresses: this.clientManager?.clients.map((c) => c.wallet)||[],
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
    } catch {
      return false
    }

    if (r.data && r.data.is_active) {
      log.info(`Webhook ${r.data.id} created`)
      await this.setWebHookId(r.data)
      return true
    }
    return false
  }

  update = async (chain:1|137=1) => {
    if (!this.webhook_ids.has(chain)) {
      throw Error('update: no webhook_id')
    }
    const body = JSON.stringify({
      webhook_id: this.webhook_ids.get(chain),
      addresses: this.clientManager?.clients.map((c) => c.wallet)||[],
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

  addWalletsToChain = async (wallets: string|string[],chain_id:1|137) => {
    let walletsToAdd = wallets
    if (typeof wallets == 'string') {
      walletsToAdd = [wallets]
    }

    const Wid = this.webhook_ids.get(chain_id)
    if (!Wid) {
      this.queues.set(chain_id,[...wallets, ...this.queues.get(chain_id)||[]]) 
      log.warn(`addWallet: no webhook_id for ${chain_id}; saving to queue`)
      return false
    }

    if (!wallets.length) {
      return false
    }

    const body = {
      webhook_id: Wid,
      addresses_to_add: [...wallets],
      addresses_to_remove: [],
    }

    return await udpateWebhookAddresses(body)
  }

  addWalletsToAllChains = async (wallets: string | string[]) => {
    let walletsToAdd = wallets
    if (typeof wallets == 'string') {
      walletsToAdd = [wallets]
    }

    let success:Record<number,boolean> ={1:false,137:false}

    for(const chain_id of SUPPORTED_CHAINS){
      let Wid = this.webhook_ids.get(chain_id)

      if (!Wid) {
        this.queues.set(chain_id,[...walletsToAdd, ...this.queues.get(chain_id)||[]]) 
        log.warn(`addWallet: no webhook_id for ${chain_id}; saving to queue`)
        success[chain_id]=false
        continue;
      }


      if (!walletsToAdd.length) {
        success[chain_id]=false
        continue
      }

      const body = {
        webhook_id: Wid,
        addresses_to_add: [...walletsToAdd],
        addresses_to_remove: [],
      }

      let p = await udpateWebhookAddresses(body)
      if(!p){
        success[chain_id]=false
        continue
      }else{
        log.info(`wallet ${JSON.stringify(wallets)} added`)
        success[chain_id]=true
      }
    }
    return success
  }

  removeWallet = async (wallet: string) => {
    let success =false
    for(const chain_id of SUPPORTED_CHAINS){
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

    let p
    try {
      p = await fetch(`https://dashboard.alchemyapi.io/api/update-webhook-addresses`, { method: 'PATCH', headers, body })
    } catch (e) {
      log.error(e)
      return false
    }
    let r = await p.json()

    if (r) {
      log.info(`wallet ${wallet} removed`)
      return true
    }
    return false
    }

  }


  clean = () => {
    for(const chain_id of SUPPORTED_CHAINS){
      let Wid = this.webhook_ids.get(chain_id)
      if (!!Wid) {
        WebhookManager.removeHook({ id:Wid})
      }
    }

  }

  static removeHook = async (hook: hookIdOnly) => {
    if (!hook) {
      return
    }

    let p
    try {
      p = await fetch(`https://dashboard.alchemyapi.io/api/delete-webhook?webhook_id=${hook.id}`, { method: 'DELETE', headers })
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
