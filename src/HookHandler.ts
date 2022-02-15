import { alchemyNotifyResponse, isValidSignature } from './lib/lib'
import { getCollectibleMetadata, getNameMetadata, getParcelMetadata, isCVCollection, isCVContract, isCVName } from './lib/helper'
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
    if(activity.category!=='token' && activity.category!=='erc1155'){
     continue
    }

    let category:'token'|'collectible'|'coin'|'parcel' = 'token'
    let token_id = activity.erc721TokenId
    let metadata = null
    let chain =body.network=='MAINNET'?1:body.network=='MATIC_MAINNET'?137:8007
    const from = get42AddressFrom64(activity.fromAddress)
    const to = get42AddressFrom64(activity.toAddress)
    const address =activity.rawContract.address

    if(activity.asset=='CVPA' && !!isCVContract(address)){
      category = 'parcel'
      if(activity.log){
        token_id = parseInt(activity.log?.data,16).toString()
        metadata = await getParcelMetadata(token_id)
      }
    }else if(activity.category == 'erc1155'){

      if(!activity.erc1155Metadata){
        continue
      }
      let isCollection = await isCVCollection(address)
      if(isCollection){

        for(const mt of activity.erc1155Metadata){
          let metadata = await getCollectibleMetadata(chain,address,parseInt(mt.tokenId,16))
          if(!metadata){
            continue
          }
          const msg = {
            from,
            to,
            chain,
            hash:activity.hash,
            value:parseInt(mt.value),
            category:'collectible',
            contract:address,
            token_id:parseInt(mt.tokenId,16).toString(),
            metadata
          }

            const clients = clientManager.clients.filter((c)=>c.wallet.toLowerCase()==to.toLowerCase())
            for(const client of clients){
              if(client){
                client.sendNotify(msg)
              }
            }
        }
      }


    }else if(isCVName(address)){
      category = 'token'
      if(activity.log){
        token_id = parseInt(activity.log?.data,16).toString()
        metadata = await getNameMetadata(token_id)
      }
    }
    
    console.log(from)
    console.log(to)
    const msg = {
      from,
      to,
      chain,
      hash:activity.hash,
      value:activity.value,
      category,
      contract:address,
      token_id,
      metadata
    }
    // filter because there can be multiple clients with the same wallet
    const clients = clientManager.clients.filter((c)=> c.wallet.toLowerCase()==to.toLowerCase())
    for(const client of clients){
      if(client){
        client.sendNotify(msg)
      }

    }

  }
}

const get42AddressFrom64 = (address:string)=>{
  return address.length>43?'0x' + address.substring('0x000000000000000000000000'.length,address.length):address
}