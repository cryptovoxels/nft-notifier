require('dotenv').config()
import cors from 'cors'
import express, { NextFunction } from 'express'
import WebSocket, { Server } from 'ws'
import { server,serverListen, app, HEALTHCHECK_URL, createLogger, createWWWLogger } from '@cryptovoxels/app-basics'
import { name, version } from '../package.json'
import { IncomingMessage } from 'http'
import { createWebSocketClientChannel } from './createWebSocketClientChannel'
import { ClientManager } from './ClientManager'
import { createRateLimiter } from './createRateLimiter'
import hookHandler from './HookHandler'
import { CLIENT_INACTIVE_TIMEOUT_MS } from './client'

const bodyParser = require("body-parser")
// @todo make sure the 'app_template' below is changed to the apps name so we can find the logs in LogDNA
const log = createLogger('nft-notifier')

const jwtSecret = process.env.JWT_SECRET|| process.env.UAT_JWT_SECRET
if (!jwtSecret) {
  throw new Error('Invalid configuration: JWT_SECRET is required')
}

const loginRateLimiter = createRateLimiter({
  keyPrefix: 'login_fail_ip',
  points: 2,
  duration: 60 * 60,
  blockDuration: 60 * 15,
})

const whitelist = [
  'https://cryptovoxels.com',
  'http://cryptovoxels.com',
  'https://www.cryptovoxels.com',
  'http://www.cryptovoxels.com',
  'http://cryptovoxels.local:9000',
  'http://localhost:9000',
  'https://uat.cryptovoxels.com',
]
const corsOptions: cors.CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, origin?: boolean) => void) => {
    if (origin == undefined) {
      callback(null, true)
      return
    }
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error(`Origin ${origin} is not allowed by CORS rules`))
    }
  },
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
}

app.use(cors(corsOptions))
app.use(createWWWLogger('nft-notifier'))
app.use(bodyParser.json())

app.get('/', (req: express.Request, res: express.Response) => {
  res.status(200).end(`welcome to ${name} ${version}`)
})

app.get('/favicon.ico', (req: express.Request, res: express.Response) => res.sendStatus(204))

// health check to signal if the service needs to be restarted, see health_check in app.yaml
app.get(HEALTHCHECK_URL, (req: express.Request, res: express.Response) => {
  res.status(200).end(`up`)
})


// GENERATE WEBSOCKET 
const wss = new Server({ server: server, maxPayload: 4096, perMessageDeflate: false })

const clientManager = new ClientManager(jwtSecret, loginRateLimiter)


app.post('/hook', (req: express.Request, res: express.Response,next:NextFunction) =>{ 
  if(!clientManager){
  res.status(400).send('Not ready')
  return
}else{
  next()
}
},(req,res)=>hookHandler(req,res,clientManager))


const inactiveInterval = setInterval(() => {
  clientManager.removeInactiveClients()

  if (clientManager.clients.length === 0) {
    clientManager.webhookManager.clean()
  }

}, CLIENT_INACTIVE_TIMEOUT_MS)


wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
  const ipAddr = inferIpAddr(req)
    addClient( ws,ipAddr)
})

wss.on('listening', () => {
  log.info('Websocket server started')
})
wss.on('close', () => {
  clearInterval(inactiveInterval)
  log.info('Websocket server closing')
})

serverListen()


async function addClient(ws: WebSocket,ipAddr:string): Promise<void> {
  const clientChannel = createWebSocketClientChannel(ws)

  const result = await clientManager.addClient(clientChannel,ipAddr)
  if (result.kind === 'error') {
    throw `unhandled error from tryAddClient`
  }
}


function inferIpAddr(req: IncomingMessage): string {
  let ipAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip'
  return Array.isArray(ipAddr) ? ipAddr[0] : ipAddr
}
