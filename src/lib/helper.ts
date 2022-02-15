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