// Local-only browser checks. Build with JOBFINDER_BASE=/ first.
// Requires Playwright (or PLAYWRIGHT_MODULE pointing to an installed copy).
// Uses an isolated temporary database, fictional accounts and NO email provider.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createApp } from '../server/app.js'
import { createAdminAccount } from '../server/panel.js'
import { hashPassword } from '../server/security.js'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const tempRoot = mkdtempSync(path.join(tmpdir(), 'jobfinder-browser-check-'))
const server = createServer()
let api, browser
let passed = 0
const pass = (name) => { passed += 1; console.log(`PASS ${name}`) }
const password = 'BrowserCheck2026'

try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  api = createApp({
    host: '127.0.0.1', port: 0, appOrigin: origin,
    dbPath: path.join(tempRoot, 'test.sqlite'), uploadDir: path.join(tempRoot, 'uploads'),
    seedOnStart: true, secureCookies: false, sessionTtlSeconds: 3600,
    rememberTtlSeconds: 7200, resetTokenTtlSeconds: 1800, authRateLimit: 1000,
    notificationsEnabled: false, mail: { provider: 'none' },
  })
  // The staging checkout itself may live under a dot-prefixed parent directory.
  api.app.use(express.static(path.join(projectRoot, 'dist'), { dotfiles: 'allow' }))
  api.app.get('/{*path}', (_req, res) => res.sendFile(path.join(projectRoot, 'dist/index.html'), { dotfiles: 'allow' }))
  server.on('request', api.app)
  async function call(route, body, cookie, method = body ? 'POST' : 'GET') {
    const response = await fetch(`${origin}/api${route}`, {
      method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await response.json()
    assert.ok(response.ok, JSON.stringify(data))
    return { data, cookie: response.headers.get('set-cookie')?.match(/jf_session=[^;]+/)?.[0] }
  }
  const legacy = api.db.prepare('SELECT * FROM jobs ORDER BY id').all()
  assert.equal(legacy.length, 36)
  const seeker = await call('/auth/register', {
    role: 'job-seeker', email: 'browser-seeker@example.test', password, firstName: 'Test', lastName: 'Seeker',
  })
  const employer = await call('/auth/register', {
    role: 'employer', email: 'browser-employer@example.test', password,
    companyName: 'Browser Test Company', industry: 'Retail', contactName: 'Test Employer',
  })
  createAdminAccount(api.db, {
    email: 'browser-peso@example.test', passwordHash: await hashPassword(password), officeName: 'Test PESO',
  })
  const pending = await call('/employer/jobs', {
    status: 'active', title: 'Browser Test Inventory Clerk', category: 'Administrative',
    description: 'Fictional job for local browser verification only.', responsibilities: ['Count stock'],
    requirements: ['Relevant experience'], benefits: [], requiredSkills: ['Inventory Management'],
    preferredSkills: [], employmentType: 'Full-time', workArrangement: 'On-site', experienceLevel: 'Associate',
    location: 'Pulung Cacutud, Angeles City', city: 'Angeles City', province: 'Pampanga',
    barangay: 'Pulung Cacutud', address: 'Angeles Livelihood Complex', salary: 'Negotiable',
    salaryMin: null, salaryMax: null, openings: 1, applicationDeadline: '2099-12-31',
    lat: 15.16, lng: 120.57, coordinateSource: 'exact-address',
  }, employer.cookie)
  assert.equal(pending.data.job.reviewStatus, 'pending')
  assert.equal((await call('/jobs')).data.total, 36)

  browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  // No external tile traffic or email is needed for these UI checks.
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.origin === origin ? route.continue() : route.abort()
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.setDefaultTimeout(15_000)
  async function login(email) {
    await page.goto(`${origin}/signin`)
    await page.locator('input[type=email]').fill(email)
    await page.locator('input[type=password]').fill(password)
    await page.locator('form button[type=submit]').click()
    await page.waitForURL(url => url.pathname !== '/signin')
  }
  const preferences = async () => (await call('/me/preferences', undefined, seeker.cookie)).data.preferences
  const notice = text => page.getByText(text, { exact: true })

  await login('browser-seeker@example.test')
  await page.goto(`${origin}/search`)
  await page.locator('summary').filter({ hasText: 'Ranking: skill match' }).click()
  const slider = page.locator('#skill-weight')
  await slider.waitFor()
  // PREF-06: fast edits remain local until Save; only the final choice is persisted.
  await slider.press('Home')
  await slider.press('End')
  for (let i = 0; i < 3; i++) await slider.press('ArrowLeft')
  assert.equal(await slider.inputValue(), '85')
  assert.equal((await preferences()).skillWeightPercent, 70)
  await page.getByRole('button', { name: 'Save weights', exact: true }).click()
  await notice('Saved. Rankings now use 85/15.').waitFor()
  assert.equal((await preferences()).skillWeightPercent, 85)
  await page.reload()
  await page.waitForFunction(() => document.querySelector('#skill-weight')?.value === '85')
  await page.locator('summary').filter({ hasText: 'Ranking: skill match' }).click()
  pass('PREF-06: rapid slider changes save the final value and survive reload')

  // PREF-10: a failed save must not change the persisted or advertised ranking weights.
  await slider.press('ArrowLeft')
  const failPreferences = route => route.request().method() === 'PATCH'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Test preference outage' } }) })
    : route.continue()
  await page.route('**/api/me/preferences', failPreferences)
  await page.getByRole('button', { name: 'Save weights', exact: true }).click()
  await notice('Test preference outage').waitFor()
  await notice('Not saved yet. Rankings still use 85/15.').waitFor()
  assert.equal((await preferences()).skillWeightPercent, 85)
  await page.unroute('**/api/me/preferences', failPreferences)
  await page.getByRole('button', { name: 'Save weights', exact: true }).click()
  await notice('Saved. Rankings now use 80/20.').waitFor()
  assert.equal((await preferences()).skillWeightPercent, 80)
  pass('PREF-10: failed preference save preserves old weights; retry succeeds')

  await page.getByRole('button', { name: 'Profile', exact: true }).first().click()
  await page.waitForFunction(() => document.querySelector('#skill-weight')?.value === '80')
  pass('saved weights are consistent between Search and Profile')

  const failSave = route => route.request().method() === 'PUT'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Test saved-job outage' } }) })
    : route.continue()
  await page.route('**/api/me/saved-jobs/*', failSave)
  await page.getByRole('button', { name: 'Home', exact: true }).first().click()
  const saveButton = () => page.locator('button[class*="hover:scale-110"]').first()
  await saveButton().click()
  await notice('Test saved-job outage').waitFor()
  await page.getByRole('button', { name: 'Search Jobs', exact: true }).first().click()
  await notice('Test saved-job outage').waitFor({ state: 'hidden' })
  pass('action error is cleared on in-app navigation')
  await page.getByRole('button', { name: 'Home', exact: true }).first().click()
  await saveButton().click()
  await notice('Test saved-job outage').waitFor()
  await page.goBack()
  await page.waitForURL(`${origin}/search`)
  await notice('Test saved-job outage').waitFor({ state: 'hidden' })
  await page.unroute('**/api/me/saved-jobs/*', failSave)
  pass('action error is cleared on browser Back navigation')

  await context.clearCookies()
  await login('browser-peso@example.test')
  await page.waitForURL(`${origin}/admin`)
  await page.getByRole('button', { name: 'Job Postings', exact: true }).click()
  await notice('Browser Test Inventory Clerk').waitFor()
  await page.getByRole('button', { name: 'Review', exact: true }).click()
  await page.getByRole('button', { name: 'Save decision', exact: true }).click()
  await notice('Browser Test Inventory Clerk').waitFor({ state: 'hidden' })
  const publicJobs = (await call('/jobs')).data
  assert.equal(publicJobs.total, 37)
  assert.equal(publicJobs.items.find(job => job.id === pending.data.job.id)?.reviewStatus, 'approved')
  pass('PESO signs into its dashboard and approves a future posting through the UI')

  await page.setViewportSize({ width: 375, height: 812 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Mobile page overflows horizontally')
  assert.deepEqual(api.db.prepare("SELECT * FROM jobs WHERE review_status='legacy' ORDER BY id").all(), legacy)
  assert.equal(api.notifications.enabled, false)
  assert.deepEqual(pageErrors, [])
  pass('375px admin page fits; all 36 legacy postings unchanged; no real email or browser exceptions')
  console.log(`Browser release checks: ${passed}/${passed} passed (isolated local database only).`)
} finally {
  if (browser) await browser.close()
  if (server.listening) await new Promise(resolve => server.close(resolve))
  if (api) api.close()
  // Only remove the exact temporary directory this script just created.
  if (path.dirname(tempRoot) === path.resolve(tmpdir()) && path.basename(tempRoot).startsWith('jobfinder-browser-check-')) {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}
