import { motion } from 'framer-motion'
import { deriveTrust, inferCategory, formatAddress, makeProof, buildComparison, categoryMeta } from '../lib/agents'
import { useAgentReputation } from '../lib/useContracts'

const SCAN_URL = 'https://8004scan.io'

export default function AgentCard({ agent, onHire, onSelect, expanded, index }) {
  const category = inferCategory(agent)
  const meta = categoryMeta[category]
  const trust = deriveTrust(agent)
  const isDemo = agent.id.startsWith('56:demo:')
  const isLive = !isDemo && agent.tokenId

  // Read on-chain reputation from AgentRegistry (only for live agents with tokenId)
  const { jobsCompleted, jobsFailed, avgRating } = useAgentReputation(isLive ? agent.tokenId : null)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: Math.min(index * 0.03, 0.5), type: 'spring', stiffness: 120 }}
      whileHover={{ y: -4 }}
      onClick={() => onSelect(agent.id)}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: 20,
        cursor: 'pointer',
        backdropFilter: 'blur(12px) saturate(150%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent 0%, ${meta.color}80 50%, transparent 100%)`,
        opacity: 0.6,
      }} />

      {/* Head */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `linear-gradient(135deg, ${meta.color}30 0%, ${meta.color}08 100%)`,
          border: `1px solid ${meta.color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 800, color: meta.color, flexShrink: 0, overflow: 'hidden',
        }}>
          {agent.image && agent.image.startsWith('https://8004scan')
            ? <img src={agent.image} alt={agent.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : agent.name.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: '#fff',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{agent.name}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
            {agent.chainId}:{agent.tokenId}{isDemo ? ' / DEMO' : ''}
          </div>
        </div>
        {/* On-chain rating badge */}
        {isLive && avgRating > 0 && (
          <div style={{
            padding: '4px 10px', borderRadius: 20,
            background: 'rgba(240,185,11,0.12)', border: '1px solid rgba(240,185,11,0.3)',
            fontSize: 11, fontWeight: 700, color: '#f0b90b',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            ★ {avgRating}.0
          </div>
        )}
      </div>

      {/* Description */}
      <p style={{
        fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 14,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{agent.description}</p>

      {/* Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        <Tag bg={`${meta.color}18`} color={meta.color}>{meta.code}</Tag>
        {agent.x402 && <Tag bg='rgba(240,185,11,0.12)' color='#f0b90b'>x402</Tag>}
        {agent.verified && <Tag bg='rgba(0,255,163,0.12)' color='#00ffa3'>verified</Tag>}
        {isDemo && <Tag bg='rgba(255,255,255,0.06)' color='rgba(255,255,255,0.4)'>demo</Tag>}
        {isLive && jobsCompleted > 0 && (
          <Tag bg='rgba(0,255,163,0.08)' color='#00ffa3'>{jobsCompleted} jobs</Tag>
        )}
      </div>

      {/* Trust bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Trust {isLive && jobsCompleted > 0 ? '+ On-Chain Reputation' : 'Score'}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>
            {isLive && avgRating > 0 ? avgRating : trust}
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${isLive && avgRating > 0 ? (avgRating / 5) * 100 : trust}%` }}
            transition={{ delay: 0.3 + index * 0.03, duration: 0.6, ease: 'easeOut' }}
            style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${meta.color}50 0%, ${meta.color} 100%)` }}
          />
        </div>
      </div>

      {/* Expanded proof */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          style={{
            marginTop: 14, padding: 14, borderRadius: 10,
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f0b90b', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
            On-Chain Proof
          </div>
          {buildComparison(agent).map(([k, v]) => (
            <ProofRow key={k} k={k} v={v} />
          ))}
          <ProofRow k='registry' v={makeProof(agent).identityRegistry} />
          <ProofRow k='owner' v={formatAddress(makeProof(agent).owner)} />
          {isLive && (
            <>
              <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: '#00ffa3' }}>Registry Stats</div>
              <ProofRow k='jobs completed' v={jobsCompleted} />
              <ProofRow k='jobs failed' v={jobsFailed} />
              <ProofRow k='avg rating' v={avgRating > 0 ? `${avgRating}/5` : 'N/A'} />
            </>
          )}
        </motion.div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={(e) => { e.stopPropagation(); onHire(agent) }}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 10,
            border: '1px solid rgba(240,185,11,0.3)',
            background: 'linear-gradient(135deg, rgba(240,185,11,0.15) 0%, rgba(240,185,11,0.05) 100%)',
            color: '#f0b90b', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >Hire</motion.button>
        <a
          href={`${SCAN_URL}/agents/bsc/${agent.tokenId}`}
          target='_blank' rel='noopener noreferrer'
          onClick={(e) => e.stopPropagation()}
          style={{
            padding: '10px 14px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center',
          }}
        >Scan ↗</a>
      </div>
    </motion.div>
  )
}

function Tag({ children, bg, color }) {
  return <span style={{ padding: '3px 8px', borderRadius: 8, background: bg, color, fontSize: 10, fontWeight: 600 }}>{children}</span>
}

function ProofRow({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11 }}>
      <span style={{ color: 'rgba(255,255,255,0.35)' }}>{k}</span>
      <span style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'right', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(v)}</span>
    </div>
  )
}
