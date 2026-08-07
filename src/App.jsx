import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { AnimatePresence } from 'framer-motion'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { config, bsc } from './wagmiConfig'
import { fetchAgents, mergeLiveAndDemo, groupByCategory, categoryOrder } from './lib/agents'

import Header from './components/Header'
import TrackBar from './components/TrackBar'
import AgentCard from './components/AgentCard'
import HireDialog from './components/HireDialog'
import JobTracker from './components/JobTracker'

const REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
const SCAN_URL = 'https://8004scan.io'

function AppContent() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTrack, setActiveTrack] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [hireAgent, setHireAgent] = useState(null)
  const [activeJob, setActiveJob] = useState(null)
  const searchTimer = useRef(null)

  const load = useCallback(async (searchQuery) => {
    setLoading(true)
    setError(null)
    try {
      const live = await fetchAgents({ search: searchQuery || '' })
      setAgents(mergeLiveAndDemo(live))
      setRateLimited(false)
    } catch (err) {
      const is429 = err.message.includes('429')
      setError(err.message)
      setRateLimited(is429)
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
    <div className='app-container'>
      <Header />

      <div className='app-content'>
        {/* Hero */}
        <section className='hero-section'>
          <h1 className='hero-title'>
            The <span className='hero-accent'>Smart Money</span> marketplace
          </h1>
          <p className='hero-subtitle'>
            Live ERC-8004 agents on BNB Smart Chain. Browse by category,
            verify on-chain proof, and hire with escrow via ERC-8183.
          </p>
          <div className='hero-stats'>
            <div className='stat-pill'>
              <span className='dot' />
              <strong>{agents.length}</strong> agents live
            </div>
            <div className='stat-pill'>
              BSC <strong>mainnet</strong>
            </div>
            <div className='stat-pill'>
              ERC-<strong>8004</strong> · ERC-<strong>8183</strong>
            </div>
          </div>

          {/* Track bar */}
          <TrackBar
            active={activeTrack}
            counts={counts}
            onSelect={setActiveTrack}
          />
        </section>

        {/* Search */}
        <div className='search-bar'>
          <span className='search-icon'>⌕</span>
          <input
            type='text'
            placeholder='Search agents by name, category, or address...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Section header */}
        <div className='section-header'>
          <h2>
            {activeTrack === 'all' ? 'All Agents' : `${activeTrack} agents`}
          </h2>
          <span className='meta'>
            {loading ? 'Loading...' : `${visibleAgents.length} agents · chain 56`}
          </span>
        </div>

        {/* Loading */}
        {loading && <div className='loading-glow' />}

        {/* Error */}
        {error && !loading && (
          <div className='empty-state' style={{ borderColor: rateLimited ? '#fbbf24' : 'var(--border)' }}>
            {rateLimited
              ? '8004scan rate-limited (HTTP 429). Showing demo agents with backoff retry.'
              : `8004scan unreachable: ${error}. Showing demo agents.`}
          </div>
        )}

        {/* Empty */}
        {!loading && visibleAgents.length === 0 && !error && (
          <div className='empty-state'>No agents found in this category.</div>
        )}

        {/* Grid */}
        <div className='agent-grid'>
          <AnimatePresence mode='popLayout'>
            {visibleAgents.map((agent, i) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                index={i}
                onHire={setHireAgent}
                onSelect={(id) => setExpandedId(expandedId === id ? null : id)}
                expanded={expandedId === agent.id}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Hire dialog */}
      <AnimatePresence>
        {hireAgent && (
          <HireDialog
            agent={hireAgent}
            onClose={() => setHireAgent(null)}
            onJobCreated={(job) => setActiveJob(job)}
          />
        )}
      </AnimatePresence>

      {/* Job tracker */}
      <AnimatePresence>
        {activeJob && (
          <JobTracker job={activeJob} onClose={() => setActiveJob(null)} />
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className='app-footer'>
        <div>
          Data: <a href={SCAN_URL} target='_blank' rel='noopener noreferrer'>8004scan.io</a> ·
          Registry: <a href={`https://bscscan.com/address/${REGISTRY_ADDRESS}`} target='_blank' rel='noopener noreferrer'>BscScan</a> ·
          ERC-<a href='https://eips.ethereum.org/EIPS/eip-8004' target='_blank' rel='noopener noreferrer'>8004</a> ·
          ERC-<a href='https://eips.ethereum.org/EIPS/eip-8183' target='_blank' rel='noopener noreferrer'>8183</a>
        </div>
        <div>
          <span style={{ color: '#00ffa3' }}>
            <span className='dot' style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#00ffa3', marginRight: 6 }} /> live
          </span>
        </div>
      </footer>
    </div>
  )
}

const queryClient = new QueryClient()

export default function App() {
  return (
    <StrictMode>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            theme={darkTheme({
              accentColor: '#f0b90b',
              accentColorForeground: '#0a0a0a',
              borderRadius: 'medium',
              overlayBlur: 'small',
            })}
            initialChain={bsc}
          >
            <AppContent />
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </StrictMode>
  )
}
