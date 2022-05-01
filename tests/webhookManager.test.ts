import test, { Test } from 'tape'
import WebhookManager from '../src/WebHookManager'


test('WebhookManager: no webhook', (t: Test) => {
 let webhookManager = new WebhookManager()

 t.false(webhookManager.webhook_ids.has('ETH_MAINNET'))
 t.false(webhookManager.webhook_ids.has('MATIC_MAINNET'))
})

test('WebhookManager: init', async (t: Test) => {
  const webhookManager = new WebhookManager()
  await webhookManager.init()
  t.true(webhookManager.webhook_ids.has('ETH_MAINNET'))
  t.true(webhookManager.webhook_ids.has('MATIC_MAINNET'))
 })
 

 test('WebhookManager: init', async (t: Test) => {
  const webhookManager = new WebhookManager()
  await webhookManager.init()
  t.true(webhookManager.webhook_ids.has('ETH_MAINNET'))
  t.true(webhookManager.webhook_ids.has('MATIC_MAINNET'))
 })