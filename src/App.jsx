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

function useWallet() {
  const [address, setAddress] = useState(null)

  useEffect(() => {
    if (typeof window.ethereum === 'undefined') return
    window.ethereum.request({ method: 'eth_accounts' }).then((accounts) => {
      if (accounts[0]) setAddress(accounts[0])
    }, [])

    window.ethereum.on('accountsChanged', (accs) => setAddress(accs[0] || null))
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

  return { address, connect }
}

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

function HireDialog({ agent, address, onClose }) {
  const draft = useMemo(() => buildHireDraft(agent, address), [agent, address])
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
        style={{ maxWidth: 420, width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h4>Hire draft — {agent.name}</h4>
        {Object.entries(draft).map(([k, v]) => (
          <div key={k} className='era-proof-row'>
            <span className='era-proof-key'>{k}</span>
            <span className='era-proof-val' style={{ fontSize: 11 }}>{String(v)}</span>
          </div>
        ))}
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--era-ink-muted)' }}>
          This is a portable ERC-8183 job intent. No signing key is exposed.
          Next step: pass the memo to an ERC-8183 client (e.g. bnbagent SDK)
          to fund, negotiate, and dispatch on-chain.
        </p>
        <button className='era-btn' style={{ marginTop: 12, width: '100%' }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

function App() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTrack, setActiveTrack] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [hireAgent, setHireAgent] = useState(null)
  const { address, connect } = useWallet()
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
            Browse by category, decode on-chain proof, and prepare an ERC-8183 hire draft.
            {REGISTRY_ADDRESS.slice(0, 10)}…
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
          onClose={() => setHireAgent(null)}
        />
      )}

      <footer className='era-shell era-footer'>
        <div>
          Data: <a href={SCAN_URL} target='_blank' rel='noopener noreferrer'>8004scan.io</a> ·
          Registry: <a href={`https://bscscan.com/address/${REGISTRY_ADDRESS}`} target='_blank' rel='noopener noreferrer'>BscScan</a> ·
          Standard: <a href='https://eips.ethereum.org/EIPS/eip-8004' target='_blank' rel='noopener noreferrer'>ERC-8004</a>
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
