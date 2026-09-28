import { createInterface } from 'node:readline/promises'
import { loadConfig } from '../config.js'
import { migrate, openDatabase } from '../db.js'
import { createAdminAccount } from '../panel.js'
import { passwordProblems } from '../password.js'
import { hashPassword } from '../security.js'

const email = String(process.argv[2] ?? '').trim()
const officeName = String(process.argv[3] ?? 'PESO Angeles City').trim()
if (!email.includes('@')) {
  console.error('Usage: npm run admin:create -- <email> "<office name>"')
  process.exit(1)
}

const prompt = createInterface({ input: process.stdin, output: process.stdout })
const password = await prompt.question('Password for the new administrator: ')
const again = await prompt.question('Type the password again: ')
prompt.close()

const problems = passwordProblems(password)
if (password !== again) {
  console.error('The passwords do not match. Nothing was created.')
  process.exit(1)
}
if (problems.length > 0) {
  console.error(`Password needs: ${problems.join(', ').toLowerCase()}. Nothing was created.`)
  process.exit(1)
}

const config = loadConfig()
const db = openDatabase(config.dbPath)
try {
  migrate(db)
  const id = createAdminAccount(db, { email, passwordHash: await hashPassword(password), officeName })
  console.log(`PESO administrator created for ${officeName} (${email}), account ID ${id}.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  db.close()
}
