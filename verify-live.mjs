import { chromium } from 'playwright'

const URL = 'https://dropmoltbot.github.io/era-market/'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(5000)

  const title = await page.title()
  if (!title.includes('ERA')) throw new Error(`Bad title: ${title}`)

  const cards = await page.locator('.era-agent-card').count()
  if (cards < 4) throw new Error(`Only ${cards} agent cards rendered`)

  const trackBarVisible = await page.locator('.era-track-bar').isVisible()
  if (!trackBarVisible) throw new Error('Track bar not visible')

  await page.locator('.era-track').first().click()
  await page.waitForTimeout(500)

  await page.locator('.era-agent-card').first().click()
  await page.waitForTimeout(500)
  const proofVisible = await page.locator('.era-proof-panel').first().isVisible()
  if (!proofVisible) throw new Error('Proof panel did not appear')

  await page.locator('.era-btn-primary').first().click()
  await page.waitForTimeout(500)
  const hireDialog = await page.locator('.era-proof-panel h4').count()
  if (hireDialog < 1) throw new Error('Hire dialog did not open')

  await page.mouse.click(10, 10)
  await page.waitForTimeout(300)

  const scanLinks = await page.locator('a[href*="8004scan.io"]').count()
  if (scanLinks === 0) throw new Error('No 8004scan links found')

  const walletBtn = await page.locator('.era-wallet-btn').count()
  if (walletBtn === 0) throw new Error('Wallet button not found')

  console.log('LIVE VERIFICATION PASSED:')
  console.log(`  URL: ${URL}`)
  console.log(`  Title: ${title}`)
  console.log(`  Agent cards: ${cards}`)
  console.log(`  Track bar: ${trackBarVisible}`)
  console.log(`  Proof panel: ${proofVisible}`)
  console.log(`  Hire dialog: ${hireDialog > 0}`)
  console.log(`  8004scan links: ${scanLinks}`)
  console.log(`  Wallet button: ${walletBtn > 0}`)
  console.log(`  Console errors: ${errors.length}`)
  if (errors.length > 0) console.log('  Errors:', errors.slice(0, 5))

  await browser.close()
  process.exit(0)
}

run().catch((err) => {
  console.error('VERIFICATION FAILED:', err.message)
  process.exit(1)
})
