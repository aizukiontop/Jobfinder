import { createApp } from './app.js'
import { loadConfig } from './config.js'

const config = loadConfig()
const { app, close } = createApp(config)
const server = app.listen(config.port, config.host, () => {
  console.log(`JobFinder API listening on http://${config.host}:${config.port}`)
})

function shutdown(signal) {
  console.log(`Received ${signal}; stopping JobFinder API`)
  server.close(() => {
    close()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

