import * as jwt from 'jsonwebtoken'
import {createLogger } from '@cryptovoxels/app-basics'
import { ClientChannel } from './lib/ClientChannel'
import { Policy } from 'cockatiel'
import { ClientManager } from './ClientManager'
import { LoginMessage, messages, MessageSubscribed, MessageType, PingMessage, PongMessage, throwUnhandledCase } from './lib/lib'
import * as cvMessages from '@cryptovoxels/messages'

export const CLIENT_INACTIVE_TIMEOUT_MS = 60000 * 5

const log= createLogger('nft-notifier-client')

// Create a retry policy that'll retry whatever function we execute two more times with a randomized exponential backoff if it throws
const retry = Policy.handleAll().retry().attempts(2).exponential()
retry.onRetry((reason) => log.debug(`retrying a function call, delaying ${reason.delay.toFixed(1)}ms`))

export class Client {
  private readonly connectedAt: number
  private lastActive: number

  wallet: string = ''
  settings: Record<string, unknown> | null = null
  hasUpdated: boolean = false

  constructor(
    private readonly jwtSecret: string,
    private readonly channel: ClientChannel,
    private readonly clientManager: ClientManager,
    public readonly ipAddr: string,
  ) {
    this.connectedAt = Date.now()
    this.lastActive = this.connectedAt

    channel.onMessage((message) => this.onMessage(message))
    channel.onError((error) => this.onError(error))
    channel.onClose((code, reason) => this.onClose(code, reason))

    log.debug('client connected', this.whois())
  }

  async send(msg:messages): Promise<void> {
    const result = await this.channel.send(JSON.stringify(msg))

    switch (result.kind) {
      case 'successful': {
        log.debug(`sent ${msg.type} message; len: ${JSON.stringify(msg).length}`)
        break
      }
      case 'failure': {
        log.error('ws.send error', result.error)
        break
      }
      case 'skipped':
        break
      default:
        throwUnhandledCase(result)
    }
  }

  sendNotify = (msg:{from:string,to:string,contract:string})=>{
    this.send({type:'notify',...msg})
  }

  ageInSec(): number {
    return (Date.now() - this.connectedAt) / 1000
  }

  drop(code: number, reason: string) {
    this.channel.close(code, reason)
  }

  isActive(): boolean {
    return Date.now() - this.lastActive <= CLIENT_INACTIVE_TIMEOUT_MS
  }

  private onError(err: Error) {
    log.error(`socket error: ${err}`, this.whois())
    this.unsubscribe()
  }

  private onClose(reasonCode: number, description?: string) {
    log.debug(`client closed ${reasonCode} ${description}`, this.whois())
    this.unsubscribe()
  }

  private unsubscribe (){
    if(this.clientManager.clientHasUniqueWallet(this)){
      // don't remove wallet from webhook if wallet is used at multiple places
      this.clientManager.webhookManager.removeWallet(this.wallet)
    }
    this.clientManager.removeClient(this)
  }


  private onMessage(message: string) {
    let data = JSON.parse(message)
    
    try {
      this.processMessage(data)
    } catch (err) {
      log.error(`error processing message ${err}\n\n${message}`, this.whois())
      return this.drop(1003, 'error on processing message')
    }
    this.lastActive = Date.now()
  }

  /** returns true if the message should be broadcast **/
  private processMessage(data: messages): void {
    const msg = data

    // log.debug(`received ${msg.type} message ${JSON.stringify(data).length}b`, this.whois())

    if (!msg.type) {
      throw new Error('no msg.type found')
    }

    const typeName = msg.type
    if (typeof typeName == 'undefined') {
      const whois = this.whois()
      //whois['msg'] = msg
      log.warn('received nonsensical message', whois)
    }

    switch (msg.type) {
      case 'login':
        this.handleLogin(msg as LoginMessage)
        break
      case 'unsubscribe':
        this.unsubscribe()
        break

      case 'ping':
        this.handlePing()
        break

      default:
        log.error(`unknown message type ${msg.type}`, this.whois())
        break
    }
  }

  private async handleLogin(message: LoginMessage): Promise<void> {
    let decoded = null
    let pckge:cvMessages.LoginMessage|null = null
    try{
      pckge = cvMessages.decode(Uint8Array.from(message.bytes))
    }catch(err){
      console.error(err)
    }
    if(!pckge){
      this.failedLogin(`Bad Message`)
      return
    }

    try {
      decoded = jwt.verify(pckge.token, this.jwtSecret)
    } catch (err: any) {
      this.failedLogin(`Bad JWT: '${err.toString()}'`)
      return
    }

    // @ts-ignore
    const wallet = decoded?.wallet

    if (!wallet) {
      this.failedLogin("Bad JWT, it's empty")
      return
    }

    this.clientManager.successfulLogin(this.ipAddr).then(/** NOOP */)

    this.wallet = wallet

    const msg: MessageSubscribed = {
      type: 'subscribed'
    }

    this.clientManager.webhookManager.addWallets(this.wallet)

    this.send(msg)
  }


  private handlePing(): void {
    const msg: PongMessage = { type: 'pong' }
    this.send(msg)
  }

  private failedLogin(msg: string) {
    log.error(`failed login: ${msg}`, this.whois())
    this.drop(1008, 'failed login')
    this.clientManager.failedLogin(this.ipAddr).then(/** NOOP */)
  }

  private whois(): Record<string, string> {
    const whois: Record<string, string> = { ipaddr: this.ipAddr }
    if (this.wallet) {
      whois['wallet'] = this.wallet
    }
    return whois
  }
}
