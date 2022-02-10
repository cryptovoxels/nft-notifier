import { performance } from 'perf_hooks'
import WebSocket from 'ws'
import { ClientChannel, ClientSendResult } from './lib/ClientChannel'

export const createWebSocketClientChannel = (ws: WebSocket): ClientChannel => ({
  onMessage: (cb) => ws.on('message', cb),
  onError: (cb) => ws.on('error', cb),
  onClose: (cb) => ws.on('close', cb),
  send: (message): Promise<ClientSendResult> => {
    if (ws.readyState != WebSocket.OPEN) {
      return Promise.resolve({
        kind: 'skipped',
      })
    }

    const startTime = performance.now()
    return new Promise<ClientSendResult>((resolve) => {
      ws.send(message, (error) => {
        const endTime = performance.now()
        const durationMs = endTime - startTime
        if (error) {
          resolve({
            kind: 'failure',
            durationMs,
            error,
          })
        } else {
          resolve({
            kind: 'successful',
            durationMs,
          })
        }
      })
    })
  },
  close: (code, reason) => ws.close(code, reason),
})
