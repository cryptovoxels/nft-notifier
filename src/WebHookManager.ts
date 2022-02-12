import { ClientManager } from "./ClientManager"

const fetch = require('node-fetch')
const app_id = 'ltyb827zi6bnrzg2'
const AUTH_KEY = process.env.ALCHEMY_TOKEN

const headers = {"X-Alchemy-Token":`${AUTH_KEY}`}

export default class WebhookManager {

  webhook_id:number|undefined
  clientManager:ClientManager
  is_active:boolean = false
  constructor(clientManager:ClientManager){
    this.clientManager = clientManager
    this.getRemoteHooks()
  }

  getRemoteHooks = async ()=>{
    let p 
    try{
      p = await fetch(`https://dashboard.alchemyapi.io/api/team-webhooks`,{method:'GET',headers})
    }catch(e){
      console.error(e)
      return 
    }
    
    if(!p){
      return 
    }
    let r = await p.json() as {data:{id:number,webhook_url:string,app_id:string,is_active:boolean}[]}

    if(!r.data || !r.data?.length){
      return 
    }

    let hooks = r.data.filter((d)=>d.webhook_url==`https://notifier.crvox.com/hook`)
    if(!hooks.length){
      return 
    }
    
    for(const [index,hook] of hooks.entries()){
      if(index==(hooks.length-1)){
        //keep one hook and use it
        this.webhook_id == hook.id
        continue
      }else{
        WebhookManager.removeHook(hook)
      }


    }
  }

  create = async ()=>{
    if(this.webhook_id){
      return
    }
    const body = JSON.stringify({
      app_id:"ltyb827zi6bnrzg2",
      webhook_type:4,
      webhook_url:`https://notifier.crvox.com/hook`,
      addresses:this.clientManager.clients.map((c)=>c.wallet)
    })
    console.log('create')
    let p 
    try{
      p = await fetch(`https://dashboard.alchemyapi.io/api/create-webhook`,{method:'POST',headers,body})
    }catch(e){
      console.error(e)
      return false
    }
    
    if(!p){
      return false
    }

    let r 
    try{
      r = await p.json() as {data:{id:number,app_id:string,is_active:boolean}}
    }catch{
      return false
    }

    if(r.data && r.data.is_active){
      this.webhook_id = r.data.id
      this.is_active = r.data.is_active
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

  addWallet = async (wallet:string)=>{
    if(!this.webhook_id){
      await this.create()
      return
    }

    if(!this.webhook_id){
      console.error('addWallet: No webhook_id found')
      return
    }
    const body = JSON.stringify({
      webhook_id:this.webhook_id,
      addresses_to_add:[wallet]
    })

    let p 
    try{
      p = await fetch(`https://dashboard.alchemyapi.io/api/update-webhook-addresses`,{method:'PATCH',headers,body})
    }catch(e){
      console.error(e)
      return false
    }

    let r = await p.json()
    console.log(r)

    if(r){
      return true
    }
    return false
    
  }

  removeWallet = async (wallet:string)=>{

    if(!this.webhook_id){
      console.error('removeWallet: No webhook_id found')
      return
    }

    const body = JSON.stringify({
      webhook_id:this.webhook_id,
      addresses_to_remove:[wallet]
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
      console.error(e)
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

  static removeHook = async (hook:{id:number})=>{
    if(!hook){
      return
    }
    let body = JSON.stringify({webhook_id:hook.id})
    let p 
    try{
      p = await fetch(`https://dashboard.alchemyapi.io/api/delete-webhook`,{method:'DELETE',headers,body})
    }catch(e){
      console.error(e)
      return false
    }
    
    if(!p){
      return false
    }
    let r = await p.json() as {}

    if(r){
      return true
    }
    return false
  }

}