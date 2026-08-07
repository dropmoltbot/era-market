import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './index.css'
import {
  buildComparison,
  buildHireDraft,
  categoryMeta,
  categoryOrder,
  deriveTrust,
  fetchAgents,
  formatAddress,
  groupByCategory,
  inferCategory,
  makeProof,
  mergeLiveAndDemo,
  normalizeAgent,
} from './lib/agents'

const BSC_CHAIN_PARAMS = {
  chainId: '0x38',
  chainName: 'BNB Smart Chain Mainnet',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: ['https://bsc-dataseed1.binance.org'],
  blockExplorerUrls: ['https://bscscan.com'],
}

const REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
const SCAN_URL = 'https://8004scan.io'
const BACKEND_URL = 'http://localhost:4174'

// ─── Wallet hook ─────────────────────────────────────────────
function useWallet() {
  const [address, setAddress] = useState(null)

  useEffect(() => {
    if (typeof window.ethereum === 'undefined') return
    window.ethereum.request({ method: 'eth_accounts' }).then((accounts) => {
      if (accounts[0]) setAddress(accounts[0])
    }, () => {})

    const handler = (accs) => setAddress(accs[0] || null)
    window.ethereum.on('accountsChanged', handler)
    return () => window.ethereum.removeListener?.('accountsChanged', handler)
  }, [])

  const connect = useCallback(async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Install MetaMask or a compatible EIP-1193 wallet to connect.')
      return
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setAddress(accounts[0])
      const id = await window.ethereum.request({ method: 'eth_chainId' })
      if (id.toLowerCase() !== BSC_CHAIN_PARAMS.chainId) {
        try {
          await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BSC_CHAIN_PARAMS.chainId }] })
        } catch {
          await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [BSC_CHAIN_PARAMS] })
        }
      }
    } catch (err) {
      console.error('wallet err', err)
    }
  }, [])

  const sendBnb = useCallback(async (to, wei) => {
    if (!address) return null
    try {
      const tx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to,
          value: '0x' + BigInt(wei).toString(16),
          gas: '0x5208',
        }],
      })
      return tx
    } catch (err) {
      console.error('send err', err)
      return null
    }
  }, [address])

  return { address, connect, sendBnb }
}

// ─── Job status constants ────────────────────────────────────
const JOB_STATUS = {
  OPEN: { label: 'Open', color: '#6b7280', desc: 'Job created, awaiting funding' },
  FUNDED: { label: 'Funded', color: '#fbbf24', desc: 'Payment escrowed on-chain' },
  SUBMITTED: { label: 'Executing', color: '#60a5fa', desc: 'Agent is processing the task' },
  COMPLETED: { label: 'Completed', color: '#00ffa3', desc: 'Agent delivered the result' },
  REJECTED: { label: 'Rejected', color: '#ef4444', desc: 'Agent declined the job' },
  EXPIRED: { label: 'Expired', color: '#6b7280', desc: 'Job timed out' },
}

// ─── Track bar ──────────────────────────────────────────────
function TrackBar({ active, counts, onSelect }) {
  return (
    <div className='era-track-bar'>
      {categoryOrder.map((key) => {
        const meta = categoryMeta[key]
        const count = counts[key] || 0
        return (
          <div
            key={key}
            className={`era-track ${active === key ? 'active' : ''}`}
            style={{ '--track-color': meta.color }}
            onClick={() => onSelect(key)}
          >
            <div className='era-track-code'>{meta.code}</div>
            <div className='era-track-label'>{meta.label}</div>
            <div className='era-track-count'>{count} agent{count === 1 ? '' : 's'}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Agent card ──────────────────────────────────────────────
function AgentCard({ agent, onHire, onSelect, expanded }) {
  const category = inferCategory(agent)
  const meta = categoryMeta[category]
  const trust = deriveTrust(agent)
  const proof = makeProof(agent)

  return (
    <div
      className='era-agent-card'
      style={{ '--track-color': meta.color }}
      onClick={() => onSelect(agent.id)}
    >
      <div className='era-agent-card-head'>
        <div className='era-agent-avatar'>
          {agent.image && agent.image.startsWith('https://8004scan') ? <img src={agent.image} alt={agent.name} /> : agent.name.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className='era-agent-name'>{agent.name}</h3>
          <div className='era-agent-id'>
            {agent.chainId}:{agent.tokenId} {agent.id.startsWith('56:demo:') && '· DEMO'}
          </div>
        </div>
      </div>

      <p className='era-agent-desc'>{agent.description}</p>

      <div className='era-tags'>
        <span className='era-tag protocol'>{categoryMeta[category].code}</span>
        {agent.protocols.map((p) => (
          <span key={p} className='era-tag protocol'>{p}</span>
        ))}
        {agent.x402 && <span className='era-tag x402'>x402</span>}
        {agent.verified && <span className='era-tag verified'>verified</span>}
        {agent.id.startsWith('56:demo:') && <span className='era-tag demo'>demo-fill</span>}
      </div>

      <div className='era-agent-stats'>
        <div className='era-stat'>
          <span className='era-stat-label'>trust</span>
          <span className='era-stat-value'>{trust}</span>
          <div className='era-trust-bar'><div style={{ width: `${trust}%` }} /></div>
        </div>
        <div className='era-stat'>
          <span className='era-stat-label'>feedbacks</span>
          <span className='era-stat-value'>{agent.feedbacks}</span>
        </div>
        <div className='era-stat'>
          <span className='era-stat-label'>contract</span>
          <span className='era-stat-value' style={{ fontSize: 11 }}>{formatAddress(agent.contractAddress)}</span>
        </div>
      </div>

      {expanded && (
        <div className='era-proof-panel'>
          <h4>On-chain proof</h4>
          {buildComparison(agent).map(([k, v]) => (
            <div key={k} className='era-proof-row'>
              <span className='era-proof-key'>{k}</span>
              <span className='era-proof-val'>{v}</span>
            </div>
          ))}
          <div className='era-proof-row'>
            <span className='era-proof-key'>registry</span>
            <span className='era-proof-val'>{proof.identityRegistry}</span>
          </div>
          <div className='era-proof-row'>
            <span className='era-proof-key'>owner</span>
            <span className='era-proof-val'>{formatAddress(proof.owner)}</span>
          </div>
        </div>
      )}

      <div className='era-agent-actions'>
        <button className='era-btn era-btn-primary' onClick={(e) => { e.stopPropagation(); onHire(agent) }}>
          Hire
        </button>
        <a
          className='era-btn'
          href={`${SCAN_URL}/agents/bsc/${agent.tokenId}`}
          target='_blank'
          rel='noopener noreferrer'
          onClick={(e) => e.stopPropagation()}
        >
          8004scan ↗
        </a>
      </div>
    </div>
  )
}

// ─── Job status tracker ──────────────────────────────────────
function JobStatusBadge({ status }) {
  const s = JOB_STATUS[status] || JOB_STATUS.OPEN
  return (
    <span className='era-job-badge' style={{ color: s.color, borderColor: s.color }}>
      <span className='dot' style={{ background: s.color }} /> {s.label}
    </span>
  )
}

function JobTracker({ job, onClose }) {
  const [current, setCurrent] = useState(job)
  const pollRef = useRef(null)

  useEffect(() => {
    if (!job) return
    setCurrent(job)

    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/job/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: job.jobId }),
        })
        const data = await res.json()
        if (data.ok && data.job) {
          setCurrent(data.job)
          if (data.job.status === 'COMPLETED' || data.job.status === 'REJECTED' || data.job.status === 'EXPIRED') {
            clearInterval(pollRef.current)
          }
        }
      } catch {}
    }

    pollRef.current = setInterval(poll, 1000)
    return () => clearInterval(pollRef.current)
  }, [job?.jobId])

  if (!current) return null

  const s = JOB_STATUS[current.status] || JOB_STATUS.OPEN
  const steps = ['OPEN', 'FUNDED', 'SUBMITTED', 'COMPLETED']
  const stepIdx = steps.indexOf(current.status)

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 50,
      background: 'rgba(7,10,8,0.97)', border: `1px solid ${s.color}`,
      borderRadius: 12, padding: 20, maxWidth: 380, boxShadow: '0 8px 32px rgba(0,255,163,0.15)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--era-ink-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>Active Job</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--era-ink)' }}>{current.agent}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--era-ink-muted)', cursor: 'pointer', fontSize: 18 }}>x</button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {steps.map((step, i) => (
          <div key={step} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i <= stepIdx ? s.color : 'rgba(255,255,255,0.08)',
          }} />
        ))}
      </div>

      <div style={{ marginBottom: 8 }}>
        <JobStatusBadge status={current.status} />
        <span style={{ fontSize: 11, color: 'var(--era-ink-muted)', marginLeft: 8 }}>{s.desc}</span>
      </div>

      <div className='era-proof-row'>
        <span className='era-proof-key'>jobId</span>
        <span className='era-proof-val' style={{ fontSize: 11 }}>{current.jobId}</span>
      </div>
      {current.txHash && (
        <div className='era-proof-row'>
          <span className='era-proof-key'>txHash</span>
          <span className='era-proof-val' style={{ fontSize: 11 }}>{current.txHash.slice(0, 18)}...</span>
        </div>
      )}

      {current.status === 'COMPLETED' && current.result && (
        <div style={{
          marginTop: 12, padding: 12, borderRadius: 8,
          background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.2)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#00ffa3', marginBottom: 6 }}>Result delivered</div>
          <div style={{ fontSize: 11, color: 'var(--era-ink-muted)' }}>{current.result.summary}</div>
          {current.result.verifiable && (
            <div style={{ fontSize: 10, color: '#00ffa3', marginTop: 6 }}>
              Verified on-chain · chainId={current.result.chainId} · block={current.result.blockNumber}
            </div>
          )}
        </div>
      )}

      {current.status !== 'COMPLETED' && current.status !== 'REJECTED' && current.status !== 'EXPIRED' && (
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--era-ink-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className='era-spinner' style={{ width: 10, height: 10 }} /> Polling every 1s...
        </div>
      )}
    </div>
  )
}

// ─── Hire dialog ─────────────────────────────────────────────
function HireDialog({ agent, address, sendBnb, onClose, onJobCreated }) {
  const draft = useMemo(() => buildHireDraft(agent, address), [agent, address])
  const [hiring, setHiring] = useState(false)
  const [hireStep, setHireStep] = useState('')
  const BNB_AMOUNT_WEI = '1000000000000000' // 0.001 BNB -- symbolic

  const handleHire = async () => {
    if (!address) {
      alert('Connect your BNB wallet first.')
      return
    }
    setHiring(true)
    try {
      // Step 1: Send tx (symbolic escrow funding)
      setHireStep('Requesting wallet signature...')
      const txHash = await sendBnb(REGISTRY_ADDRESS, BNB_AMOUNT_WEI)
      if (!txHash) {
        setHireStep('Transaction rejected or failed')
        setHiring(false)
        return
      }
      setHireStep('Transaction sent. Creating job on ERC-8183...')

      // Step 2: Create job via backend
      const res = await fetch(`${BACKEND_URL}/api/hire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: { ...draft, buyer: address },
          txHash,
          createdAt: new Date().toISOString(),
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setHireStep('Job created! Tracking...')
        onJobCreated(data.job)
        onClose()
      } else {
        setHireStep('Backend error: ' + (data.error || 'unknown'))
      }
    } catch (err) {
      setHireStep('Error: ' + err.message)
    } finally {
      setHiring(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        className='era-proof-panel'
        style={{ maxWidth: 440, width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h4>Hire draft - {agent.name}</h4>
        {Object.entries(draft).map(([k, v]) => (
          <div key={k} className='era-proof-row'>
            <span className='era-proof-key'>{k}</span>
            <span className='era-proof-val' style={{ fontSize: 11 }}>{String(v)}</span>
          </div>
        ))}

        <div style={{
          marginTop: 16, padding: 12, borderRadius: 8,
          background: 'rgba(0,255,163,0.05)', border: '1px solid rgba(0,255,163,0.15)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#00ffa3', marginBottom: 8 }}>
            On-chain escrow flow
          </div>
          <div style={{ fontSize: 11, color: 'var(--era-ink-muted)', lineHeight: 1.6 }}>
            1. Sign a BNB transaction to fund the escrow (0.001 BNB symbolic)<br/>
            2. Backend creates an ERC-8183 job via bnbagent SDK<br/>
            3. Agent receives the job, processes it in its TEE<br/>
            4. Result is delivered and verified on-chain
          </div>
        </div>

        {hireStep && (
          <div style={{
            marginTop: 12, padding: 10, borderRadius: 6,
            background: 'rgba(255,255,255,0.04)', fontSize: 11, color: 'var(--era-ink-muted)',
          }}>
            {hireStep}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            className='era-btn era-btn-primary'
            style={{ flex: 1 }}
            onClick={handleHire}
            disabled={hiring || !address}
          >
            {hiring ? 'Processing...' : address ? `Sign & Hire (0.001 BNB)` : 'Connect wallet first'}
          </button>
          <button className='era-btn' onClick={onClose} disabled={hiring}>
            Close
          </button>
        </div>

        {!address && (
          <p style={{ marginTop: 10, fontSize: 11, color: '#fbbf24' }}>
            Connect your BNB wallet to sign the escrow transaction.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────
function App() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTrack, setActiveTrack] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [hireAgent, setHireAgent] = useState(null)
  const [activeJob, setActiveJob] = useState(null)
  const { address, connect, sendBnb } = useWallet()
  const searchTimer = useRef(null)

  const load = useCallback(async (searchQuery) => {
    setLoading(true)
    setError(null)
    try {
      const live = await fetchAgents({ search: searchQuery || '' })
      const merged = mergeLiveAndDemo(live)
      setAgents(merged)
      setRateLimited(false)
    } catch (err) {
      const isRateLimited = err.message.includes('429')
      setError(err.message)
      setRateLimited(isRateLimited)
      setAgents(mergeLiveAndDemo([]))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => load(search), 350)
    return () => searchTimer.current && clearTimeout(searchTimer.current)
  }, [search, load])

  const grouped = useMemo(() => groupByCategory(agents), [agents])
  const counts = useMemo(() =>
    categoryOrder.reduce((acc, key) => {
      acc[key] = grouped[key].length
      return acc
    }, {}),
  [grouped])

  const visibleAgents = activeTrack === 'all' ? agents : grouped[activeTrack] || []

  return (
    <>
      <header className='era-topbar'>
        <div className='era-shell era-topbar-inner'>
          <div className='era-brand'>
            <span className='era-brand-mark'>ERA</span>
            <span className='era-brand-tagline'>Build the Era · BNB agent marketplace</span>
          </div>
          <div className='era-wire'>
            <div className='era-search'>
              <input
                type='text'
                placeholder='Search on-chain agents...'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              className={`era-wallet-btn ${address ? 'connected' : ''}`}
              onClick={connect}
            >
              {address ? formatAddress(address) : 'Connect BNB'}
            </button>
          </div>
        </div>
      </header>

      <main className='era-shell'>
        <section className='era-hero'>
          <h1>
            The <span className='accent'>Smart Money</span> marketplace
          </h1>
          <p>
            Live ERC-8004 agents on BNB Smart Chain, pulled from 8004scan.
            Browse by category, decode on-chain proof, hire with on-chain escrow via ERC-8183.
            {REGISTRY_ADDRESS.slice(0, 10)}...
          </p>
          <TrackBar
            active={activeTrack}
            counts={counts}
            onSelect={(key) => setActiveTrack(key === activeTrack ? 'all' : key)}
          />
        </section>

        <section className='era-section'>
          <div className='era-section-header'>
            <h2>
              {activeTrack === 'all'
                ? 'All categories'
                : categoryMeta[activeTrack].label}
            </h2>
            <div className='meta'>
              {loading ? 'Fetching live ERC-8004 data...' : `${visibleAgents.length} agent${visibleAgents.length === 1 ? '' : 's'} · BSC mainnet (chain 56)`}
            </div>
          </div>

          {loading && (
            <div className='era-load-bar'><div /></div>
          )}

          {error && !loading && (
            <div className='era-empty' style={rateLimited ? { borderColor: '#ffb270' } : {}}>
              {rateLimited
                ? '8004scan rate-limited (HTTP 429). Showing demo agents. Retries with backoff were attempted.'
                : `8004scan unreachable: ${error}. Showing demo agents only.`}
            </div>
          )}

          {!loading && visibleAgents.length === 0 && !error && (
            <div className='era-empty'>No agents found in this category.</div>
          )}

          <div className='era-agent-grid'>
            {visibleAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onHire={setHireAgent}
                onSelect={(id) => setExpandedId(expandedId === id ? null : id)}
                expanded={expandedId === agent.id}
              />
            ))}
          </div>
        </section>
      </main>

      {hireAgent && (
        <HireDialog
          agent={hireAgent}
          address={address}
          sendBnb={sendBnb}
          onClose={() => setHireAgent(null)}
          onJobCreated={(job) => setActiveJob(job)}
        />
      )}

      {activeJob && (
        <JobTracker job={activeJob} onClose={() => setActiveJob(null)} />
      )}

      <footer className='era-shell era-footer'>
        <div>
          Data: <a href={SCAN_URL} target='_blank' rel='noopener noreferrer'>8004scan.io</a> ·
          Registry: <a href={`https://bscscan.com/address/${REGISTRY_ADDRESS}`} target='_blank' rel='noopener noreferrer'>BscScan</a> ·
          Standard: <a href='https://eips.ethereum.org/EIPS/eip-8004' target='_blank' rel='noopener noreferrer'>ERC-8004</a> ·
          Escrow: <a href='https://eips.ethereum.org/EIPS/eip-8183' target='_blank' rel='noopener noreferrer'>ERC-8183</a>
        </div>
        <div>
          <span className='era-clock-badge'>
            <span className='dot' /> live
          </span>
        </div>
      </footer>
    </>
  )
}

export default App
