import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:5173/era-market/'
const BACKEND = 'http://localhost:4174'

async function main() {
  // Verify backend is running
  const healthRes = await fetch(`${BACKEND}/api/health`)
  const health = await healthRes.json()
  if (!health.ok) { console.error('Backend not running'); process.exit(1) }
  console.log('Backend:', health.status, 'sdk:', health.sdk)

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('8004scan')) {
      errors.push('console: ' + msg.text().slice(0, 200))
    }
  })

  console.log(`Loading ${BASE}...`)
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 })
  await page.waitForTimeout(3000)

  // Check title
  const title = await page.title()
  console.log('Title:', title)

  // Check agent cards
  const cardCount = await page.locator('.era-agent-card').count()
  console.log('Agent cards:', cardCount)

  // Check track bar
  const trackBar = await page.locator('.era-track').count()
  console.log('Track bar tabs:', trackBar)

  // Check footer mentions ERC-8183
  const footerText = await page.locator('footer').textContent()
  console.log('Footer has ERC-8183:', footerText.includes('ERC-8183'))

  // Test hire dialog (without wallet)
  console.log('\n--- Hire flow test ---')
  await page.locator('.era-agent-card').first().click({ timeout: 5000 })
  await page.waitForTimeout(500)

  // Click Hire button
  await page.locator('.era-btn-primary').first().click({ timeout: 5000 })
  await page.waitForTimeout(500)

  // Hire dialog should be visible
  const hireDialogVisible = await page.locator('h4').filter({ hasText: 'Hire draft' }).count()
  console.log('Hire dialog open:', hireDialogVisible > 0)

  // Check hire dialog content
  const hireText = await page.locator('.era-proof-panel').last().textContent()
  console.log('Has escrow flow:', hireText.includes('On-chain escrow'))
  console.log('Has sign button:', hireText.includes('Sign & Hire') || hireText.includes('Connect wallet'))

  // Check if backend URL is referenced
  console.log('Dialog mentions 0.001 BNB:', hireText.includes('0.001 BNB'))

  // Close dialog
  await page.mouse.click(10, 10)
  await page.waitForTimeout(500)

  // Test backend create job directly
  console.log('\n--- Backend job lifecycle test ---')
  const hireRes = await fetch(`${BACKEND}/api/hire`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      draft: { agent: 'TestGridBot', scope: 'grid-trading', rail: 'x402' },
      txHash: '0xdeadbeef1234567890',
      createdAt: new Date().toISOString(),
    }),
  })
  const hireData = await hireRes.json()
  console.log('Job created:', hireData.ok, 'status:', hireData.job?.status)
  const jobId = hireData.job?.jobId

  // Poll status
  await new Promise((r) => setTimeout(r, 4000))
  const statusRes = await fetch(`${BACKEND}/api/job/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId }),
  })
  const statusData = await statusRes.json()
  console.log('After 4s:', statusData.job?.status, statusData.job?.result?.summary?.slice(0, 60))

  // Check all jobs
  const jobsRes = await fetch(`${BACKEND}/api/jobs`)
  const jobsData = await jobsRes.json()
  console.log('Total jobs:', jobsData.jobs?.length)

  // Console errors
  console.log('\n--- Console errors ---')
  console.log('Errors:', errors.length)
  for (const e of errors) console.log('  ', e.slice(0, 120))

  await browser.close()

  // Verdict
  const allPass = title.includes('ERA') && cardCount > 0 && trackBar > 0
    && hireDialogVisible > 0 && hireText.includes('escrow')
    && hireData.ok && statusData.job?.status === 'COMPLETED'
    && errors.length === 0

  console.log('\n' + '='.repeat(50))
  console.log(allPass ? 'VERIFY: PASS' : 'VERIFY: ISSUES FOUND')
  console.log('='.repeat(50))
  process.exit(allPass ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
