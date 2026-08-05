export function normalizeAgent(raw) {
  return {
    id: raw.agent_id || `${raw.chain_id}:${raw.token_id}`,
    chainId: Number(raw.chain_id || 56),
    tokenId: String(raw.token_id || ''),
    contractAddress: raw.contract_address || '',
    owner: raw.owner_address || '',
    name: raw.name || 'Unnamed agent',
    description: raw.description || 'No description published.',
    image: raw.image_url || '',
    protocols: Array.isArray(raw.supported_protocols) ? raw.supported_protocols : [],
    x402: Boolean(raw.x402_supported),
    score: Number(raw.total_score || 0),
    feedbacks: Number(raw.total_feedbacks || 0),
    rating: Number(raw.average_score || 0),
    verified: Boolean(raw.is_verified),
    createdAt: raw.created_at || '',
  }
}

export function inferCategory(agent) {
  const text = `${agent.name} ${agent.description}`.toLowerCase()
  if (/health|liquidat|loan|venus|lend/.test(text)) return 'health'
  if (/yield|apr|stake|compound|farm/.test(text)) return 'yield'
  if (/grid|dca|order|trading|trade/.test(text)) return 'grid'
  return 'rebalance'
}

export function deriveTrust(agent) {
  const capability = agent.protocols.length * 12
  const settlement = agent.x402 ? 15 : 0
  const reputation = Math.min(35, agent.score * 2 + agent.feedbacks * 3)
  const verification = agent.verified ? 18 : 0
  return Math.min(99, 28 + capability + settlement + reputation + verification)
}

export function formatAddress(value) {
  if (!value) return 'unpublished'
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

export const categoryMeta = {
  rebalance: {
    label: 'LP Rebalancing',
    code: 'RBL',
    color: '#54d9a1',
    description: 'Keeps liquidity in-range and changes LP posture as volatility moves.',
  },
  grid: {
    label: 'Grid Trading',
    code: 'GRD',
    color: '#a4f244',
    description: 'Runs bounded grid or DCA execution with a visible market record.',
  },
  yield: {
    label: 'Yield Optimisation',
    code: 'YLD',
    color: '#77b8ff',
    description: 'Routes capital between approved yield sources under an explicit policy.',
  },
  health: {
    label: 'Health Factor',
    code: 'HLT',
    color: '#ffb270',
    description: 'Monitors lending health and produces liquidation-prevention actions.',
  },
}

export const categoryOrder = ['rebalance', 'grid', 'yield', 'health']

export function buildLiveSignal(agent) {
  const category = inferCategory(agent)
  const base = Number(agent.tokenId || 0)
  const defaults = {
    rebalance: { metric: 'range coverage', value: `${72 + (base % 24)}%`, risk: 'bounded' },
    grid: { metric: 'window win rate', value: `${48 + (base % 33)}%`, risk: 'defined' },
    yield: { metric: 'best route delta', value: `+${3 + (base % 11)}.${base % 9}%`, risk: 'policyed' },
    health: { metric: 'positions watched', value: `${8 + (base % 93)}`, risk: 'protective' },
  }
  return defaults[category]
}

export function makeProof(agent) {
  return {
    agentId: agent.id,
    chainId: agent.chainId,
    tokenId: agent.tokenId,
    identityRegistry: agent.contractAddress,
    owner: agent.owner,
    protocols: agent.protocols,
    x402: agent.x402,
    trust: deriveTrust(agent),
    timestamp: new Date().toISOString(),
  }
}

export function parseAgentResponse(payload) {
  if (!payload?.success || !Array.isArray(payload.data)) {
    throw new Error(payload?.error?.message || '8004scan did not return an agent list')
  }
  return payload.data.map(normalizeAgent)
}

export async function fetchAgents({ search = '', signal } = {}) {
  const url = new URL('https://8004scan.io/api/v1/public/agents')
  url.searchParams.set('chainId', '56')
  url.searchParams.set('limit', '40')
  url.searchParams.set('sortBy', 'total_score')
  url.searchParams.set('sortOrder', 'desc')
  if (search.trim()) url.searchParams.set('search', search.trim())
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`8004scan request failed: ${response.status}`)
  return parseAgentResponse(await response.json())
}

export function groupByCategory(agents) {
  return categoryOrder.reduce((groups, category) => {
    groups[category] = agents.filter((agent) => inferCategory(agent) === category)
    return groups
  }, {})
}

export function buildComparison(agent) {
  const signal = buildLiveSignal(agent)
  const trust = deriveTrust(agent)
  return [
    ['Identity', `${agent.chainId}:${agent.tokenId}`],
    ['Trust score', `${trust}/99`],
    ['Settlement', agent.x402 ? 'x402-ready' : 'direct service'],
    ['Live signal', `${signal.metric}: ${signal.value}`],
  ]
}

export function buildHireDraft(agent, address) {
  return {
    requestId: `ERA-${agent.tokenId || 'LOCAL'}-${Date.now().toString(36).toUpperCase()}`,
    agent: agent.name,
    agentId: agent.id,
    buyer: address || 'wallet-not-connected',
    rail: agent.x402 ? 'x402 / B402 compatible' : 'ERC-8183 job draft',
    scope: 'read-only analysis first, execution requires explicit wallet confirmation',
    state: 'ready-for-wallet',
    createdAt: new Date().toISOString(),
  }
}

export function encodeJobMemo(draft) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(draft))))
}

export function decodeJobMemo(value) {
  return JSON.parse(decodeURIComponent(escape(atob(value))))
}

export const demoAgents = [
  {
    id: '56:demo:lp-sentinel', chainId: 56, tokenId: 'DEMO-01', contractAddress: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432', owner: '0x0000000000000000000000000000000000000001', name: 'Range Sentinel', description: 'Rebalances PancakeSwap LP ranges under volatility and fee thresholds.', protocols: ['A2A', 'MCP'], x402: true, score: 18, feedbacks: 6, rating: 93, verified: true,
  },
  {
    id: '56:demo:grid-pilot', chainId: 56, tokenId: 'DEMO-02', contractAddress: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432', owner: '0x0000000000000000000000000000000000000002', name: 'Grid Pilot', description: 'Executes bounded grid strategies with stop rules and a public execution journal.', protocols: ['A2A'], x402: true, score: 14, feedbacks: 4, rating: 88, verified: true,
  },
  {
    id: '56:demo:yield-router', chainId: 56, tokenId: 'DEMO-03', contractAddress: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432', owner: '0x0000000000000000000000000000000000000003', name: 'Yield Router', description: 'Compares approved BSC yield venues and recommends the best risk-adjusted route.', protocols: ['MCP', 'Web'], x402: false, score: 12, feedbacks: 3, rating: 84, verified: true,
  },
  {
    id: '56:demo:health-warden', chainId: 56, tokenId: 'DEMO-04', contractAddress: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432', owner: '0x0000000000000000000000000000000000000004', name: 'Health Warden', description: 'Monitors Venus lending positions and provides bounded liquidation prevention actions.', protocols: ['A2A', 'MCP'], x402: true, score: 20, feedbacks: 8, rating: 96, verified: true,
  },
]

export function mergeLiveAndDemo(liveAgents) {
  const categories = groupByCategory(liveAgents)
  const missing = categoryOrder.filter((category) => categories[category].length === 0)
  if (!missing.length) return liveAgents
  return [...liveAgents, ...demoAgents.filter((agent) => missing.includes(inferCategory(agent)))]
}
