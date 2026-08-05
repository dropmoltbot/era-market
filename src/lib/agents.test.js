import { describe, expect, it } from 'vitest'
import {
  buildHireDraft,
  categoryOrder,
  decodeJobMemo,
  deriveTrust,
  encodeJobMemo,
  groupByCategory,
  inferCategory,
  mergeLiveAndDemo,
  normalizeAgent,
  parseAgentResponse,
} from './agents'

const rawGrid = {
  agent_id: '56:0xregistry:177310',
  chain_id: 56,
  token_id: '177310',
  contract_address: '0xregistry',
  owner_address: '0xowner',
  name: 'TradePilot.agent',
  description: 'Automated crypto trading bot with DCA, grid, and rebalancing strategies.',
  supported_protocols: ['A2A'],
  x402_supported: true,
  total_score: 12,
  total_feedbacks: 2,
  average_score: 92,
  is_verified: true,
}

describe('ERC-8004 marketplace data layer', () => {
  it('preserves canonical BSC identity details from an API record', () => {
    const agent = normalizeAgent(rawGrid)

    expect(agent.id).toBe('56:0xregistry:177310')
    expect(agent.chainId).toBe(56)
    expect(agent.tokenId).toBe('177310')
    expect(agent.protocols).toEqual(['A2A'])
    expect(agent.x402).toBe(true)
  })

  it('classifies every official marketplace category from agent capabilities', () => {
    expect(inferCategory(normalizeAgent(rawGrid))).toBe('grid')
    expect(inferCategory(normalizeAgent({ name: 'Yield', description: 'Optimizes APR and farms', token_id: '1' }))).toBe('yield')
    expect(inferCategory(normalizeAgent({ name: 'Warden', description: 'Monitors loan liquidation health factor', token_id: '2' }))).toBe('health')
    expect(inferCategory(normalizeAgent({ name: 'Ranger', description: 'Manages LP range exposure', token_id: '3' }))).toBe('rebalance')
  })

  it('derives more trust for verifiable, paid, protocol-capable agents', () => {
    const trusted = deriveTrust(normalizeAgent(rawGrid))
    const blank = deriveTrust(normalizeAgent({ name: 'Blank', description: '', token_id: '0' }))

    expect(trusted).toBeGreaterThan(blank)
    expect(trusted).toBeLessThanOrEqual(99)
  })

  it('fills category gaps with clearly separate demo agents rather than hiding empty official tracks', () => {
    const agents = mergeLiveAndDemo([normalizeAgent(rawGrid)])
    const groups = groupByCategory(agents)

    expect(categoryOrder.every((category) => groups[category].length > 0)).toBe(true)
    expect(groups.grid[0].id).toBe(rawGrid.agent_id)
    expect(agents.some((agent) => agent.id.startsWith('56:demo:'))).toBe(true)
  })

  it('makes a portable and reversible hire memo without exposing a signing key', () => {
    const agent = normalizeAgent(rawGrid)
    const draft = buildHireDraft(agent, '0xbuyer')
    const memo = encodeJobMemo(draft)

    expect(decodeJobMemo(memo)).toMatchObject({
      agent: 'TradePilot.agent',
      buyer: '0xbuyer',
      state: 'ready-for-wallet',
    })
  })

  it('rejects malformed 8004scan responses instead of silently inventing live data', () => {
    expect(() => parseAgentResponse({ success: false, error: { message: 'bad gateway' } })).toThrow('bad gateway')
  })
})
