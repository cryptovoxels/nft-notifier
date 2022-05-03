import { createLogger } from '@cryptovoxels/app-basics/dist/logger'
import { API, Collection } from './lib'

const fetch = require('node-fetch')
const AUTH_KEY = process.env.ALCHEMY_TOKEN
export const headers = { 'X-Alchemy-Token': `${AUTH_KEY}` }

export const isCVCollection = async (address: string) => {
  let p
  try {
    p = await fetch(`https://www.cryptovoxels.com/api/collections/${address}.json`)
  } catch (e) {
    return false
  }

  if (!p) {
    return false
  }
  let r
  try {
    r = (await p.json()) as { success: boolean; collection: Collection }
  } catch {
    return false
  }
  if (!r.success) {
    return false
  }
  return true
}

export const isCVContract = (address: string) => {
  return address?.toLowerCase() == process.env.CONTRACT_ADDRESS?.toLowerCase() || address?.toLowerCase() == process.env.RINKEBY_CONTRACT_ADDRESS?.toLowerCase()
}

export const refreshParcel = (token_id: any) => {
  try {
    fetch(`${API}/parcels/${token_id}/query`)
  } catch {}
}

export const isCVName = (address: string) => {
  return address?.toLowerCase() == process.env.NAME_ADDRESS?.toLowerCase()
}

export const getParcelMetadata = async (token_id: string) => {
  let p
  try {
    p = await fetch(`https://www.cryptovoxels.com/p/${token_id}.json`)
  } catch (e) {
    return null
  }

  if (!p) {
    return null
  }
  let r
  try {
    r = (await p.json()) as { name: string; description: string; image: string }
  } catch {
    return null
  }
  if (!r.name) {
    return null
  }
  return r
}
export const getNameMetadata = async (token_id: string) => {
  let p
  try {
    p = await fetch(`https://www.cryptovoxels.com/name/${token_id}`)
  } catch (e) {
    return null
  }

  if (!p) {
    return null
  }
  let r
  try {
    r = (await p.json()) as { name: string; description: string; image: string }
  } catch {
    return null
  }
  if (!r.name) {
    return null
  }
  return r
}

export const getCollectibleMetadata = async (chain: number, address: string, token_id: number) => {
  let p
  try {
    p = await fetch(`https://www.cryptovoxels.com/api/collections/${chain == 1 ? 'eth' : 'matic'}/${address}/c/${token_id}.json`)
  } catch (e) {
    return null
  }

  if (!p) {
    return null
  }
  let r
  try {
    r = (await p.json()) as { success: boolean; collectible: { id: string; token_id: number; name: string; description: string; issues: number; suppressed: boolean } }
  } catch {
    return null
  }
  if (!r.success) {
    return null
  }

  let slug = r.collectible.name
    ?.toLowerCase()
    .replace(/[^a-z]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')

  let imageSrc = `https://wearables.sfo2.digitaloceanspaces.com/${r.collectible.id}-${slug}.gif`
  return Object.assign(r.collectible, { image: imageSrc })
}

const log = createLogger('HOOKManager')

export async function udpateWebhookAddresses(body: { webhook_id: string ; addresses_to_add: string[]; addresses_to_remove: string[] }) {
  const pckge = JSON.stringify(body)

  let p
  try {
    p = await fetch(`https://dashboard.alchemyapi.io/api/update-webhook-addresses`, { method: 'PATCH', headers, body: pckge })
  } catch (e) {
    console.error(e)
    return false
  }
  let r
  try {
    r = await p.json()
  } catch (e) {
    console.error(e)
    return false
  }

  if (r) {
    return true
  }
  return false
}
