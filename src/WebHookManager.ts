import { ClientManager } from "./ClientManager"
import {createLogger } from '@cryptovoxels/app-basics'
const fetch = require('node-fetch')
const app_id = process.env.APP_ID
const AUTH_KEY = process.env.ALCHEMY_TOKEN
import { Policy } from 'cockatiel'

const log= createLogger('HOOKManager')
// Create a retry policy that'll retry whatever function we execute two more times with a randomized exponential backoff if it throws
const retry = Policy.handleAll().retry().attempts(2).exponential()
retry.onRetry((reason) => log.debug(`retrying a function call, delaying ${reason.delay.toFixed(1)}ms`))

const headers = {"X-Alchemy-Token":`${AUTH_KEY}`}
type hook = {id:number,webhook_url:string,app_id:string,is_active:boolean,addresses?:string[]}
type hookIdOnly = {id:number}
export default class WebhookManager {

  webhook_id:number|undefined
  clientManager:ClientManager
  is_active:boolean = false
  queue:string[] = []
  constructor(clientManager:ClientManager){
    this.clientManager = clientManager
    this.init()
  }

  async init(){
    await retry.execute(async () =>await this.getRemoteHook())
    if(!this.webhook_id){
      await this.create()
    }

  }

  getRemoteHook = async ()=>{
    let p 
    try{
      p = await fetch(`https://dashboard.alchemyapi.io/api/team-webhooks`,{method:'GET',headers})
    }catch(e){
      log.error(e)
      return null
    }
    
    if(!p){
      return null
    }
    let r 
    try{
      r= await p.json() as {data:hook[]}
    }catch{
      throw Error('bad JSON')
    }

    if(!r?.data || !r?.data?.length){
      return null
    }

    let hooks = r.data.filter((d)=>d.webhook_url===`https://notifier.crvox.com/hook` && d.app_id.toLowerCase()==app_id?.toLowerCase())
    if(!hooks.length){
      return null
    }

    log.info(`Found ${hooks.length} hooks;`)
    // find hook with most addresses in it;
    let hookWithMostAddresses:hook|null = null

    if(hooks.length==1){
      // Only one hook found, use that one;
      hookWithMostAddresses = hooks[0]
      this.setWebHookId(hookWithMostAddresses)
      return hookWithMostAddresses
    }

    // More hooks were made on Alchemy; we save the one with the most wallets saved on it;
    for(const hook of hooks){
      if(!hook.addresses){
        continue
      }
      if(!hookWithMostAddresses && hook.addresses){
        // no "hookWithMostAddresses", save the first one if it has wallets in it;
        hookWithMostAddresses =hook
        continue
      }
      if(hook.addresses.length>(hookWithMostAddresses?.addresses?.length||0)){
        hookWithMostAddresses =hook
      }
    }

    if(hookWithMostAddresses){
      // use that hook
      this.setWebHookId(hookWithMostAddresses)
    }
    // Delete all remote hooks but the one with the most addresses in it
    for(const hook of hooks){
      if(hookWithMostAddresses?.id==hook.id){
        //keep best hook and use it
        continue
      }else{
        WebhookManager.removeHook(hook)
      }

    }

    return hookWithMostAddresses
  }

  setWebHookId = async (hook:hook)=>{
    this.webhook_id = hook.id
    this.is_active = !!hook.is_active
    log.info(`Current webhook: ${hook.id}`)
    // on set webhook; go through the queue of addresses
    let a = Array.from(this.queue)
    let p = await this.addWallets(a)
    if(!p){
      this.queue = a
    }else{
      this.queue = []
    }
  }

  create = async ()=>{
    if(this.webhook_id){
      return
    }
    const body = JSON.stringify({
      app_id,
      webhook_type:4,
      webhook_url:`https://notifier.crvox.com/hook`,
      addresses:this.clientManager.clients.map((c)=>c.wallet)
    })

    let p 
    try{
      p = await fetch(`https://dashboard.alchemyapi.io/api/create-webhook`,{method:'POST',headers,body})
    }catch(e){
      log.error(e)
      return false
    }
    
    if(!p){
      return false
    }

    let r 
    try{
      r = await p.json() as {data:hook}
    }catch{
      return false
    }

    if(r.data && r.data.is_active){
      log.info(`Webhook ${r.data.id} created`)
      await this.setWebHookId(r.data)
      return true
    }
    return false
  }

  update = async ()=>{
    if(!this.webhook_id){
      throw Error('update: no webhook_id')
    }
    const body = JSON.stringify({
      webhook_id:this.webhook_id,
      addresses:this.clientManager.clients.map((c)=>c.wallet)
    })

    let p 
    try{
      p = await fetch(`https://dashboard.alchemyapi.io/api/update-webhook-addresses`,{method:'PUT',headers:headers as any,body:body as any})
    }catch(e){
      console.error(e)
      return false
    }

    let r = await p.json()

    if(r){
      return true
    }
    return false
  }

  addWallets = async (wallets:string|string[])=>{
    let walletsToAdd = wallets
    if(typeof wallets =='string'){
      walletsToAdd = [wallets]
    }

    if(!this.webhook_id){
      this.queue = [...walletsToAdd,...this.queue]
      log.warn(`addWallet: no webhook_id; saving to queue`)
      return false
    }
    if(!walletsToAdd.length){
      return
    }
    const body = JSON.stringify({
      webhook_id:this.webhook_id,
      addresses_to_add:[...walletsToAdd],
      addresses_to_remove:[]
    })

    let p 
    try{
      p = await fetch(`https://dashboard.alchemyapi.io/api/update-webhook-addresses`,{method:'PATCH',headers,body})
    }catch(e){
      console.error(e)
      return false
    }

    let r = await p.json()

    if(r){
      log.info(`wallet ${JSON.stringify(wallets)} added`)
      return true
    }
    return false
    
  }

  removeWallet = async (wallet:string)=>{

    if(!this.webhook_id){
      log.error('removeWallet: No webhook_id found')
      return
    }

    const body = JSON.stringify({
      webhook_id:this.webhook_id,
      addresses_to_add:[],
      addresses_to_remove:[wallet]
    })

    let p 
    try{
      p = await fetch(`https://dashboard.alchemyapi.io/api/update-webhook-addresses`,{method:'PATCH',headers,body})
    }catch(e){
      log.error(e)
      return false
    }
    let r = await p.json()

    if(r){
      log.info(`wallet ${wallet} removed`)
      return true
    }
    return false
    
  }

  setActive = async(bool:boolean)=>{

    const body = JSON.stringify({
      webhook_id:this.webhook_id,
      is_active:!!bool
    })

    let p 
    try{
      p = await fetch(`https://dashboard.alchemyapi.io/api/update-webhook`,{method:'PUT',headers,body})
    }catch(e){
      log.error(e)
      return false
    }
    
    if(!p){
      return false
    }

    let r = await p.json() as {}
    if(r){
      this.is_active=bool
      return true
    }
    return false
  }

  clean = ()=>{
    if(this.webhook_id){
      WebhookManager.removeHook({id:this.webhook_id})
    }
  }

  static removeHook = async (hook:hookIdOnly)=>{
    if(!hook){
      return
    }

    let p 
    try{
      p = await fetch(`https://dashboard.alchemyapi.io/api/delete-webhook?webhook_id=${hook.id}`,{method:'DELETE',headers})
    }catch(e){
      log.error(e)
      return false
    }
    
    if(!p){
      return false
    }
    let r = await p.json() as {} 

    if(r){
      log.info(`removed Hook ${hook.id}`)
      return true
    }
    return false
  }

}