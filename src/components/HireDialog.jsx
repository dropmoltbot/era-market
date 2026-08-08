import { motion } from 'framer-motion'
import { useAccount } from 'wagmi'
import { useMemo, useState, useEffect } from 'react'
import { buildHireDraft } from '../lib/agents'
import { useCreateJob, CONTRACTS } from '../lib/useContracts'

const HIRE_AMOUNT_ETH = '0.001'

export default function HireDialog({ agent, onClose, onJobCreated }) {
  const { address } = useAccount()
  const { createJob, isPending, isConfirming, isSuccess, txHash } = useCreateJob()
  const draft = useMemo(() => buildHireDraft(agent, address), [agent, address])
  const [error, setError] = useState('')
  const [step, setStep] = useState('idle') // idle | signing | confirming | done | error

  const handleHire = async () => {
    if (!address) { setError('Connect your wallet first'); return }
    setError('')
    setStep('signing')
    try {
      // Extract tokenId from agent.id (format: "56:tokenid" or "56:demo:x")
      const tokenId = agent.tokenId || 1
      const hash = await createJob(
        tokenId,
        draft.scope || 'agent-job',
        draft.memo || 'era-market-hire',
        HIRE_AMOUNT_ETH
      )
      setStep('confirming')
    } catch (err) {
      setError(err.shortMessage || err.message || 'Transaction failed')
      setStep('error')
    }
  }

  useEffect(() => {
    if (isConfirming && step !== 'done') setStep('confirming')
    if (isSuccess && step !== 'done') {
      setStep('done')
      setTimeout(() => {
        onJobCreated?.({ jobId: 'pending', agent: agent.name, txHash, status: 'FUNDED' })
        onClose()
      }, 1200)
    }
  }, [isConfirming, isSuccess, txHash])

  const steps = ['Sign', 'Escrow', 'Execute', 'Result']
  const stepOrder = ['signing', 'confirming', 'done', 'done']
  const activeIdx = stepOrder.indexOf(step)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 200,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90%', maxWidth: 460, borderRadius: 20,
          background: 'rgba(15,15,15,0.98)',
          border: '1px solid rgba(240,185,11,0.15)',
          padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: '#f0b90b', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
              Hire Agent
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginTop: 4 }}>
              {agent.name}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 10,
            color: 'rgba(255,255,255,0.5)', fontSize: 18, cursor: 'pointer', padding: '6px 12px',
          }}>x</button>
        </div>

        {/* Draft */}
        <div style={{
          background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 16,
          marginBottom: 20, border: '1px solid rgba(255,255,255,0.04)',
        }}>
          {Object.entries(draft).slice(0, 6).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>{k}</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'right', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace' }}>
                {String(v).length > 42 ? String(v).slice(0, 42) + '...' : String(v)}
              </span>
            </div>
          ))}
        </div>

        {/* On-chain info */}
        <div style={{
          marginBottom: 20, padding: 12, borderRadius: 10,
          background: 'rgba(240,185,11,0.05)', border: '1px solid rgba(240,185,11,0.15)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#f0b90b', marginBottom: 8 }}>
            On-Chain Escrow via JobEscrow
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            Contract: {CONTRACTS.escrow.slice(0, 10)}...{CONTRACTS.escrow.slice(-6)}<br/>
            Amount: {HIRE_AMOUNT_ETH} BNB (escrowed)<br/>
            Agent Token: #{agent.tokenId || 'demo'}<br/>
            Network fee: 1% platform fee on completion
          </div>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {steps.map((label, i) => {
            const isActive = i <= activeIdx
            const isCurrent = i === activeIdx
            return (
              <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  height: 3, borderRadius: 2, marginBottom: 6,
                  background: isActive ? '#f0b90b' : 'rgba(255,255,255,0.08)',
                  boxShadow: isCurrent ? '0 0 8px rgba(240,185,11,0.5)' : 'none',
                }} />
                <span style={{ fontSize: 10, color: isActive ? '#f0b90b' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Status */}
        {step === 'signing' && (
          <StatusBox color='#f0b90b'>Opening wallet to sign transaction...</StatusBox>
        )}
        {step === 'confirming' && (
          <StatusBox color='#60a5fa'>
            Transaction sent! Waiting for block confirmation...<br/>
            <span style={{ fontSize: 10, fontFamily: 'monospace' }}>{txHash?.slice(0, 20)}...</span>
          </StatusBox>
        )}
        {step === 'done' && (
          <StatusBox color='#00ffa3'>Job created on-chain! Escrow funded.</StatusBox>
        )}
        {step === 'error' && <StatusBox color='#ef4444'>{error}</StatusBox>}

        {/* Button */}
        <button
          onClick={handleHire}
          disabled={isPending || isConfirming || step === 'done'}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
            background: address
              ? 'linear-gradient(135deg, #f0b90b 0%, #f8d33a 100%)'
              : 'rgba(255,255,255,0.05)',
            color: address ? '#0a0a0a' : 'rgba(255,255,255,0.4)',
            fontSize: 14, fontWeight: 800, cursor: 'pointer',
            boxShadow: address ? '0 4px 16px rgba(240,185,11,0.25)' : 'none',
          }}
        >
          {!address ? 'Connect Wallet First'
            : isPending ? 'Signing...'
            : isConfirming ? 'Confirming...'
            : step === 'done' ? 'Done!'
            : `Hire for ${HIRE_AMOUNT_ETH} BNB (On-Chain)`}
        </button>
      </motion.div>
    </motion.div>
  )
}

function StatusBox({ children, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        marginBottom: 16, padding: 12, borderRadius: 10,
        background: `${color}11`, border: `1px solid ${color}22`,
        fontSize: 12, color, display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      {(color === '#f0b90b' || color === '#60a5fa') && (
        <span style={{
          width: 12, height: 12, border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: color, borderRadius: '50%', display: 'inline-block',
          animation: 'era-spin 0.7s linear infinite',
        }} />
      )}
      <div>{children}</div>
    </motion.div>
  )
}
