import { createApp } from './app.js'
import { loadConfig } from './config.js'

const config = loadConfig()
const { app, close, notifications } = createApp(config)
const server = app.listen(config.port, config.host, () => {
  console.log(`JobFinder API listening on http://${config.host}:${config.port}`)
})

const notificationTimer = notifications.enabled
  ? setInterval(() => {
    notifications.processBatch().catch((error) => console.error('Notification batch failed:', error.message))
  }, 60_000)
  : null

function shutdown(signal) {
  console.log(`Received ${signal}; stopping JobFinder API`)
  if (notificationTimer) clearInterval(notificationTimer)
  server.close(async () => {
    await notifications.stop()
    close()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

