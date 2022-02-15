import { Collection } from "./lib"

const fetch = require('node-fetch')

export const getCollectibleCollection =async (address:string)=>{
  let p 
  try{
    p = await fetch(`https://www.cryptovoxels.com/api/collections/${address}.json`)
  }catch(e){
    return null
  }
  
  if(!p){
    return null
  }
  let r 
  try{
    r= await p.json() as {success:boolean,collection:Collection}
  }catch{
    return null
  }
  if(!r.success){
    return null
  }
  return r.collection
}

export const isCVContract=(address:string)=>{
  return address.toLowerCase() == process.env.CONTRACT_ADDRESS?.toLowerCase() || address.toLowerCase() == process.env.RINKEBY_CONTRACT_ADDRESS?.toLowerCase()
}