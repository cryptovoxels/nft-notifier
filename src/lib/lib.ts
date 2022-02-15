import express from 'express'
const crypto = require('crypto')

export function throwUnhandledCase(n: never): never {
  throw new Error('Unhandled case: ' + JSON.stringify(n))
}

export function isValidSignature(request:express.Request) {    
  const token = 'zoyH14z0ZxPAaMEguARrSmwwgVo4gwvS';
  const headers = request.headers;
  const signature = headers['x-alchemy-signature']; // Lowercase for NodeJS
  const body = request.body;    
  const hmac = crypto.createHmac('sha256', token) // Create a HMAC SHA256 hash using the auth token
  hmac.update(JSON.stringify(body), 'utf8') // Update the token hash with the request body using utf8
  const digest = hmac.digest('hex');     
  return (signature === digest); // If signature equals your computed hash, return true
}

export type MessageType = 'subscribe' | 'unsubscribe' | 'notify' |'ping'|'pong' | 'login' |'subscribed'

export type Message = {type:MessageType}
export type MessageSubscribe = {type:'subscribe',wallet:string}
export type MessageSubscribed = {type:'subscribed'}
export type LoginMessage = {type:'login',jwt:string}
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
  category:'external'|'internal'|'token',
  hash:string,
  value:number,
  erc721TokenId:string|null,
  erc1155Metadata:any,
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
  network:string,
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