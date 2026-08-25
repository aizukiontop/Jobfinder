import { loadConfig } from '../config.js'
import { migrate, openDatabase } from '../db.js'

const config = loadConfig()
const db = openDatabase(config.dbPath)
try {
  migrate(db)
  console.log(`Migrated JobFinder database: ${config.dbPath}`)
} finally {
  db.close()
}

