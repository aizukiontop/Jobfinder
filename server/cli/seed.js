import { loadConfig } from '../config.js'
import { migrate, openDatabase, seedVerifiedJobs } from '../db.js'

const config = loadConfig()
const db = openDatabase(config.dbPath)
try {
  migrate(db)
  const result = seedVerifiedJobs(db)
  console.log(`Seeded ${result.count} verified external jobs (${result.sha256})`)
} finally {
  db.close()
}

