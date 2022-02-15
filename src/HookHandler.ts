import { alchemyNotifyResponse, isValidSignature } from './lib/lib'
import { getCollectibleCollection, getParcelMetadata, isCVContract } from './lib/helper'
import express from 'express'
import { ClientManager } from './ClientManager'

export default async function hookHandler  (req: express.Request, res: express.Response,clientManager:ClientManager)  {
  console.log(req.headers)
  // if(!isValidSignature(req)){
  //   res.status(400).send('Nothing to see here')
  //   return
  // }

  if(!('app' in req.body)){
    res.status(200).send('Nothing to see here')
    return
  }

  const body = req.body as alchemyNotifyResponse

  res.status(200).end() // reply quickly

  if(!body.activity){
    // we currently dont care about dropped tx or mined tx;
    return
  }

  // handle the webhook content
  for (const activity of body.activity){
    console.log(activity)
    if(activity.category!=='token'){
     continue
    }

    let category:'token'|'collectible'|'coin'|'parcel' = 'token'
    let token_id = activity.erc721TokenId
    let metadata = null
    if(activity.asset=='CVPA' && !!isCVContract(activity.rawContract.address)){
      category = 'parcel'
      if(activity.log){
        token_id = parseInt(activity.log?.data,16).toString()
        console.log(token_id)
        metadata = await getParcelMetadata(token_id)
      }
    }

    let p = await getCollectibleCollection(activity.rawContract.address)
    if(p){
      category = 'collectible'
    }


    // Here we need to convert the Address from Alchemy which looks like 
    //"0x0000000000000000000000003e4f2bae78b177b01d209e167f1cbc8839dbccf7"
    // into something like this:
    //"0x3e4f2bae78b177b01d209e167f1cbc8839dbccf7"

    const from = get42AddressFrom64(activity.fromAddress)
    const to = get42AddressFrom64(activity.toAddress)

    console.log(from)
    console.log(to)
    
    // filter because there can be multiple clients with the same wallet
    // const clients = clientManager.clients.filter((c)=>c.wallet==from.toLowerCase() || c.wallet==to.toLowerCase())
    // for(const client of clients){
    //   if(client){
    //     const msg = {from,to,contract:activity.rawContract.address}
    //     client.sendNotify(msg)
    //   }

    // }
    const msg = {
      from,
      to,
      hash:activity.hash,
      value:activity.value,
      category,
      contract:activity.rawContract.address,
      token_id,
      metadata
    }
    clientManager.clients.forEach(c => c.sendNotify(msg));
  }
}

const get42AddressFrom64 = (address:string)=>{
  return address.length>43?'0x' + address.substring('0x000000000000000000000000'.length,address.length):address
}