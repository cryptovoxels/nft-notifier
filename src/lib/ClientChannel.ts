
export type ClientChannel = {
  onMessage(cb: (message: string) => void): void
  onError(cb: (error: Error) => void): void
  onClose(cb: (code: number, reason: string) => void): void
  send(data: unknown): Promise<ClientSendResult>
  close(code: number, reason: string): void
}

export type ClientSendResult = ClientSendResult.Successful | ClientSendResult.Failure | ClientSendResult.Skipped

export namespace ClientSendResult {
  export type Successful = {
    kind: 'successful'
    durationMs: number
  }

  export type Failure = {
    kind: 'failure'
    durationMs: number
    error: Error
  }

  export type Skipped = {
    kind: 'skipped'
  }
}
