import express from 'express'
const crypto = require('crypto')

export function throwUnhandledCase(n: never): never {
  throw new Error('Unhandled case: ' + JSON.stringify(n))
}

const tokens = ['zoyH14z0ZxPAaMEguARrSmwwgVo4gwvS','whsec_MjzSgW0GUzuDwTK9wfrw5YN4'];

export function isValidSignature(request:express.Request) {    

  const headers = request.headers;
  const signature = headers['x-alchemy-signature']; // Lowercase for NodeJS
  const body = request.body; 

  let digests = tokens.map((token)=>{
    const hmac = crypto.createHmac('sha256', token) // Create a HMAC SHA256 hash using the auth token
    hmac.update(JSON.stringify(body), 'utf8') // Update the token hash with the request body using utf8
    return hmac.digest('hex');  
  })
   
  return !!digests.some((digest)=>signature === digest); // If signature equals your computed hash, return true
}

export const API = 'https://www.cryptovoxels.com/api/'

export type MessageType = 'subscribe' | 'unsubscribe' | 'notify' |'ping'|'pong' | 'login' |'subscribed' |number

export type Message = {type:MessageType}
export type MessageSubscribe = {type:'subscribe',wallet:string}
export type MessageSubscribed = {type:'subscribed'}
export type LoginMessage = {type:'login',bytes:Array<any>}
export type PingMessage = {type:'ping'}
export type PongMessage = {type:'pong'}

export type messages = Message | MessageSubscribe |MessageSubscribed | LoginMessage| PingMessage | PongMessage

export type notifyMinedTX = {
  hash:string,
  blockHash:string,
  blockNumber:string,
  from:string,
  gas:string,
  gasPrice:string,
  input:string,
  nonce:string,
  r:string,
  s:string,
  to:string,
  transactionIndex:string,
  v:string,
  value:string
}
export type notifyDroppedTX = {
  hash:string,
  blockHash:string|null,
  blockNumber:string|null,
  from:string,
  gas:string,
  gasPrice:string,
  input:string,
  nonce:string,
  r:string,
  s:string,
  to:string,
  transactionIndex:string|null,
  v:string,
  value:string
}

export type notifyActivity = {
  fromAddress:string,
  toAddress:string,
  blockNum:string,
  category:'external'|'internal'|'token'|'erc1155',
  hash:string,
  value:number,
  erc721TokenId:string|null,
  erc1155Metadata:{tokenId:string,value:string}[]|null,
  typeTraceAddress:string|null,
  asset:string,
  log:ethLog|null|undefined
  rawContract:{
    rawValue:string,
    address:string,
    decimals:number
  }
}

export type alchemyNotifyResponse = {
  app:string,
  network:'MAINNET'|'RINKEBY'|'MATIC_MAINNET',
  webhookType:'ADDRESS_ACTIVITY'|'DROPPED_TRANSACTION'|'MINED_TRANSACTION',
  timestamp:string,
  activity:notifyActivity[] |undefined
  fullTransaction:notifyDroppedTX|notifyMinedTX|undefined
}

type ethLog = {
  address:string,
  topics:string[]
  data:string,
  blockNumber:string,
  transactionHash:string,
  transactionIndex:string,
  blockHash:string,
  logIndex:string,
  removed:boolean
}


export type Collection= {
  id:number,
  name:string,
  description:string,
  image_url:string,
  owner:string,
  owner_name:string,
  address:string,
  slug:string,
  type:"ERC1155"|"ERC721",
  chainid:1|137,
  settings:any,
    rejected_at:null,
    created_at:string}