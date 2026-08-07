import { AnimatePresence, motion } from 'framer-motion'
import { useAccount, useSendTransaction } from 'wagmi'
import { parseEther } from 'viem'
import { useMemo, useState } from 'react'
import { buildHireDraft } from '../lib/agents'

const REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
const BACKEND_URL = 'http://localhost:4174'
const HIRE_AMOUNT_ETH = '0.001'

export default function HireDialog({ agent, onClose, onJobCreated }) {
  const { address } = useAccount()
  const { sendTransactionAsync, isPending: isTxPending } = useSendTransaction()
  const draft = useMemo(() => buildHireDraft(agent, address), [agent, address])
  const [step, setStep] = useState('idle') // idle | signing | sent | creating | done | error
  const [errorMsg, setErrorMsg] = useState('')
  const [txHash, setTxHash] = useState('')

  const handleHire = async () => {
    if (!address) {
      setErrorMsg('Connect your wallet first')
      setStep('error')
      return
    }

    try {
      setStep('signing')
      setErrorMsg('')

      // Step 1: Sign transaction via wagmi/RainbowKit
      const tx = await sendTransactionAsync({
        to: REGISTRY_ADDRESS,
        value: parseEther(HIRE_AMOUNT_ETH),
        data: '0x',
      })
      setTxHash(tx)
      setStep('sent')

      // Step 2: Create job via backend
      setStep('creating')
      const res = await fetch(`${BACKEND_URL}/api/hire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: { ...draft, buyer: address },
          txHash: tx,
          createdAt: new Date().toISOString(),
        }),
      })
      const data = await res.json()

      if (data.ok) {
        setStep('done')
        setTimeout(() => {
          onJobCreated?.(data.job)
          onClose()
        }, 1200)
      } else {
        setErrorMsg(data.error || 'Backend error')
        setStep('error')
      }
    } catch (err) {
      setErrorMsg(err.shortMessage || err.message || 'Transaction failed')
      setStep('error')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
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
          width: '90%',
          maxWidth: 460,
          borderRadius: 20,
          background: 'rgba(15,15,15,0.98)',
          border: '1px solid rgba(240,185,11,0.15)',
          padding: 28,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(240,185,11,0.05)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: '#f0b90b', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
              Hire Agent
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginTop: 4 }}>
              {agent.name}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: 10,
              color: 'rgba(255,255,255,0.5)',
              fontSize: 18,
              cursor: 'pointer',
              padding: '6px 12px',
            }}
          >
            x
          </button>
        </div>

        {/* Draft fields */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          {Object.entries(draft).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>{k}</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'right', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace' }}>
                {String(v).length > 42 ? String(v).slice(0, 42) + '...' : String(v)}
              </span>
            </div>
          ))}
        </div>

        {/* Escrow flow visual */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['Sign', 'Escrow', 'Execute', 'Result'].map((label, i) => {
            const stepOrder = ['signing', 'sent', 'creating', 'done']
            const activeIdx = stepOrder.indexOf(step)
            const isActive = activeIdx >= i
            const isCurrent = activeIdx === i
            return (
              <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  height: 3,
                  borderRadius: 2,
                  background: isActive ? '#f0b90b' : 'rgba(255,255,255,0.08)',
                  marginBottom: 6,
                  boxShadow: isCurrent ? '0 0 8px rgba(240,185,11,0.5)' : 'none',
                }} />
                <span style={{
                  fontSize: 10,
                  color: isActive ? '#f0b90b' : 'rgba(255,255,255,0.3)',
                  fontWeight: 600,
                }}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Status messages */}
        {step === 'signing' && (
          <StatusBox color='#f0b90b'>Opening wallet to sign transaction...</StatusBox>
        )}
        {step === 'sent' && (
          <StatusBox color='#60a5fa'>
            Transaction sent. TxHash: {txHash.slice(0, 18)}...
          </StatusBox>
        )}
        {step === 'creating' && (
          <StatusBox color='#60a5fa'>Creating ERC-8183 job on backend...</StatusBox>
        )}
        {step === 'done' && (
          <StatusBox color='#00ffa3'>
            Job created! Agent will process your request...
          </StatusBox>
        )}
        {step === 'error' && (
          <StatusBox color='#ef4444'>{errorMsg}</StatusBox>
        )}

        {/* Action button */}
        <button
          onClick={handleHire}
          disabled={isTxPending || step === 'signing' || step === 'sent' || step === 'creating' || step === 'done'}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 14,
            border: 'none',
            background: address
              ? 'linear-gradient(135deg, #f0b90b 0%, #f8d33a 100%)'
              : 'rgba(255,255,255,0.05)',
            color: address ? '#0a0a0a' : 'rgba(255,255,255,0.4)',
            fontSize: 14,
            fontWeight: 800,
            cursor: isTxPending ? 'wait' : 'pointer',
            transition: 'all 0.2s',
            boxShadow: address ? '0 4px 16px rgba(240,185,11,0.25)' : 'none',
          }}
        >
          {!address
            ? 'Connect Wallet First'
            : isTxPending
            ? 'Signing...'
            : `Hire for ${HIRE_AMOUNT_ETH} BNB`}
        </button>

        {!address && (
          <p style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
            Connect your BNB wallet to sign the escrow transaction
          </p>
        )}
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
        marginBottom: 16,
        padding: 12,
        borderRadius: 10,
        background: `${color}11`,
        border: `1px solid ${color}22`,
        fontSize: 12,
        color,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {(color === '#f0b90b' || color === '#60a5fa') && (
        <span style={{
          width: 12,
          height: 12,
          border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: color,
          borderRadius: '50%',
          display: 'inline-block',
          animation: 'era-spin 0.7s linear infinite',
        }} />
      )}
      {children}
    </motion.div>
  )
}
