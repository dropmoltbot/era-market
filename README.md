# ERA — BNB Agent Studio Marketplace

> Build the Era hackathon entry — the ERC-8004 agent marketplace for BNB Smart Chain.

**Live site:** https://dropmoltbot.github.io/era-market/

## Problem

200,000+ AI agents are registered on BNB Smart Chain under ERC-8004 (60% of all onchain agents across 26 networks). But there's no way to find, compare, or hire them. Every agent is only as useful as someone's ability to discover it.

## Solution

ERA is a live marketplace that pulls real ERC-8004 agents from the 8004scan API (~250K+ registered agents on BSC mainnet), classifies them into the four official hackathon categories, shows on-chain proof per agent, and generates a portable ERC-8183 hire draft.

## Features

- **Live 8004scan integration** — fetches real agents from `https://8004scan.io/api/v1/public/agents?chainId=56` with CORS-enabled JSON, sorted by trust score
- **4 official categories** (all first-class, per the judging rubric):
  - LP Rebalancing — manages liquidity ranges
  - Grid Trading — automated bounded grid execution
  - Yield Optimisation — routes capital to best APR
  - Health Factor — monitors lending positions against liquidation
- **On-chain proof panel** — every agent card expands to show: identity (chainId:tokenId), trust score, settlement method (x402 direct), live signal, registry address, owner address
- **ERC-8183 hire draft** — generates a portable, base64-encoded job memo (no signing key exposed) ready to pass to the bnbagent SDK
- **EIP-1193 wallet connect** — connects MetaMask to BNB Smart Chain (chain 0x38), auto-switches/adds chain if needed
- **Demo agents fill gaps** — when live 8004scan returns no agents for a category, clearly-labeled demo agents fill the slot so the marketplace never has empty categories (all 4 always populated, per the "Agent Diversity" judging criterion)
- **Semantic search** — debounced search through the 8004scan API

## Architecture

```
src/
  lib/
    agents.js       — data layer: fetch, normalize, classify, trust-score, hire-draft
    agents.test.js  — 6 unit tests (Vitest)
  App.jsx           — React frontend: track bar, agent cards, proof panel, hire dialog
  index.css         — dark green-on-black terminal palette
  main.jsx          — entry point
```

## Data Sources

- **8004scan Public API** (`https://8004scan.io/api/v1/public/agents`) — CORS-enabled, no API key needed (10 req/min anonymous). Returns structured ERC-8004 agent data: identity, chain, owner, protocols, reputation scores, feedbacks.
- **ERC-8004 Identity Registry (BSC mainnet)**: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- **ERC-8004 Identity Registry (BSC testnet)**: `0x8004A818BFB912233c491871b3d84c89A494BD9e`

## Standards Used

- **ERC-8004** — On-chain agent identity (ERC-721 based)
- **ERC-8183** — Agentic commerce protocol (job escrow, optimistic settlement)
- **x402** — HTTP 402 payment protocol for agent micropayments
- **EIP-1193** — Wallet connection standard

## Trust Score

Each agent gets a derived trust score (0-99) based on:
- Protocol support (A2A, MCP, Web, Email, OASF) — 12 points per protocol
- x402 payment support — 15 points
- Reputation score from 8004scan — up to 35 points
- Verified status — 18 points

## Run Locally

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # production build to dist/
npm test         # run unit tests
node verify.mjs  # Playwright verification (dev server must be running)
```

## Tech Stack

- React 19 + Vite 8
- Vitest (unit tests)
- Playwright (E2E verification)
- EIP-1193 direct wallet connection (no RainbowKit/wagmi overhead)
- 8004scan REST API (no backend needed — pure client-side)

## Hackathon Compliance

- [x] All 4 categories surfaced with equal depth
- [x] Agents are live on BSC (pulled from 8004scan in real-time)
- [x] Full journey works: land → find agent by category → understand what it does → see on-chain proof → generate hire draft
- [x] Publicly accessible during judging (GitHub Pages)
- [x] Real-time accurate data beyond basic counts (trust score, protocols, x402, feedbacks, reputation)
- [x] Zero-knowledge of Agent Studio required to use

## License

MIT
