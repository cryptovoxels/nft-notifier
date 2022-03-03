import test, { Test } from 'tape'
import WebhookManager from '../src/WebHookManager'


test('WebhookManager: no webhook', (t: Test) => {
 let webhookManager = new WebhookManager()

 t.false(webhookManager.webhook_ids.has(1))
 t.false(webhookManager.webhook_ids.has(137))
})

test('WebhookManager: init', async (t: Test) => {
  const webhookManager = new WebhookManager()
  await webhookManager.init()
  t.ok(true)
 })