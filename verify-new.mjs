import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:5173/era-market/'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(8000)

  const title = await page.title()
  const cardCount = await page.locator('.agent-grid > div').count()
  const headerText = await page.locator('header').textContent()
  const hasHero = await page.locator('.hero-section').count()
  const statPills = await page.locator('.stat-pill').count()
  const searchBar = await page.locator('.search-bar input').count()
  const trackButtons = await page.locator('button').filter({ hasText: /Rebalance|Grid|Yield|Health/ }).count()
  const connectBtn = await page.locator('button').filter({ hasText: /Connect/i }).count()

  // Screenshot
  await page.screenshot({ path: '/tmp/era-market-new.png' })

  // Test hire dialog
  let hireDialogWorks = false
  let hasEscrowFlow = false
  if (cardCount > 0) {
    // Expand first card
    await page.locator('.agent-grid > div').first().click({ timeout: 5000 })
    await page.waitForTimeout(500)
    
    // Click Hire button inside that card
    const hireBtn = page.locator('.agent-grid > div').first().locator('button').filter({ hasText: 'Hire' })
    if (await hireBtn.count() > 0) {
      await hireBtn.click({ timeout: 5000 })
      await page.waitForTimeout(500)
      
      const pageText = await page.evaluate(() => document.body.innerText)
      hireDialogWorks = pageText.includes('Hire Agent') || pageText.includes('Hire draft')
      hasEscrowFlow = pageText.includes('Sign') && pageText.includes('Escrow')
      
      // Check if 0.001 BNB is shown and Connect Wallet First
      console.log('Has 0.001 BNB:', pageText.includes('0.001'))
      console.log('Has Connect Wallet:', pageText.includes('Connect Wallet'))
    }
  }

  console.log('--- VERIFY NEW THEME ---')
  console.log('Title:', title)
  console.log('Agent cards:', cardCount)
  console.log('Header has ERA:', headerText.includes('ERA'))
  console.log('Hero section:', hasHero)
  console.log('Stat pills:', statPills)
  console.log('Search bar:', searchBar)
  console.log('Track tabs:', trackButtons)
  console.log('Connect button:', connectBtn)
  console.log('HireDialog works:', hireDialogWorks)
  console.log('Has escrow flow:', hasEscrowFlow)
  console.log('Console errors:', errors.length)
  for (const e of errors.slice(0, 5)) console.log('  ', e.slice(0, 150))

  await browser.close()

  const pass = title.includes('ERA') && cardCount > 0 && errors.length === 0 && hireDialogWorks
  console.log('\n' + '='.repeat(50))
  console.log(pass ? 'VERIFY: PASS' : 'VERIFY: ISSUES')
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
