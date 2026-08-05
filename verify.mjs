import { chromium } from 'playwright'

const DEV = 'http://127.0.0.1:5173/era-market/'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto(DEV, { waitUntil: 'networkidle', timeout: 20000 })
  await page.waitForTimeout(4000)

  // Check title
  const title = await page.title()
  if (!title.includes('ERA')) throw new Error(`Bad title: ${title}`)

  // Check agent cards exist (demo agents should render immediately)
  const cards = await page.locator('.era-agent-card').count()
  if (cards < 4) throw new Error(`Only ${cards} agent cards rendered (expected at least 4 demo agents)`)

  // Check track bar present
  const trackBarVisible = await page.locator('.era-track-bar').isVisible()
  if (!trackBarVisible) throw new Error('Track bar not visible')

  // Click a track
  await page.locator('.era-track').first().click()
  await page.waitForTimeout(500)

  // Click a card to expand proof
  await page.locator('.era-agent-card').first().click()
  await page.waitForTimeout(500)
  const proofVisible = await page.locator('.era-proof-panel').first().isVisible()
  if (!proofVisible) throw new Error('Proof panel did not appear on card click')

  // Click Hire button on first card
  await page.locator('.era-btn-primary').first().click()
  await page.waitForTimeout(500)
  const hireDialogCount = await page.locator('.era-proof-panel h4').count()
  if (hireDialogCount < 1) throw new Error('Hire dialog did not open')

  // Close hire dialog by clicking outside the panel
  await page.mouse.click(10, 10)
  await page.waitForTimeout(300)

  // Check 8004scan link exists
  const scanLinks = await page.locator('a[href*="8004scan.io"]').count()
  if (scanLinks === 0) throw new Error('No 8004scan links found')

  // Check wallet button present
  const walletBtn = await page.locator('.era-wallet-btn').count()
  if (walletBtn === 0) throw new Error('Wallet button not found')

  console.log('VERIFICATION PASSED:')
  console.log(`  Title: ${title}`)
  console.log(`  Agent cards: ${cards}`)
  console.log(`  Track bar: ${trackBarVisible}`)
  console.log(`  Proof panel expands: ${proofVisible}`)
  console.log(`  Hire dialog opens: ${hireDialogCount > 0}`)
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
