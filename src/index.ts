require('dotenv').config()
import cors from 'cors'
import express from 'express'
import { Connect, serverListen, app, HEALTHCHECK_URL, createLogger, createWWWLogger } from '@cryptovoxels/app-basics'
import { name, version } from '../package.json'

const { query } = Connect()
// @todo make sure the 'app_template' below is changed to the apps name so we can find the logs in LogDNA
const log = createLogger('app_template')

const origin = '*'
const exposedHeaders = ['']
app.use(cors({ origin, exposedHeaders }))
app.use(createWWWLogger('app_template'))

const sql = `select pid from pg_stat_activity limit 1;`
query(sql).then((r: any) => {
  log.info('web connected to database')
})

app.get('/', (req: express.Request, res: express.Response) => {
  res.status(200).end(`welcome to ${name} ${version}`)
})

// health check to signal if the service needs to be restarted, see health_check in app.yaml
app.get(HEALTHCHECK_URL, (req: express.Request, res: express.Response) => {
  res.status(200).end(`up`)
})

serverListen()
