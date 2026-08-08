import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount } from 'wagmi'
import { useRegisterAgent } from '../lib/useContracts'

const CATEGORIES = [
  { value: 'rebalance', label: 'LP Rebalancing' },
  { value: 'grid', label: 'Grid Trading' },
  { value: 'yield', label: 'Yield Optimisation' },
  { value: 'health', label: 'Health Factor' },
]

export default function RegisterDialog({ onClose, onRegistered }) {
  const { address } = useAccount()
  const { register, isPending, isConfirming, isSuccess } = useRegisterAgent()
  const [form, setForm] = useState({
    metadataURI: '',
    category: 'grid',
    pricePerJob: '0.001',
  })
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!address) { setError('Connect your wallet first'); return }
    if (!form.metadataURI) { setError('Metadata URI required'); return }
    setError('')
    try {
      await register(form.metadataURI, form.category, form.pricePerJob)
    } catch (err) {
      setError(err.shortMessage || err.message || 'Transaction failed')
    }
  }

  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => { onRegistered?.(); onClose() }, 1200)
    }
  }, [isSuccess])

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
      <motion.form
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          width: '90%', maxWidth: 420, borderRadius: 20,
          background: 'rgba(15,15,15,0.98)',
          border: '1px solid rgba(240,185,11,0.15)',
          padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: '#f0b90b', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
              Register Agent
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginTop: 4 }}>
              Deploy on ERC-8004
            </div>
          </div>
          <button type='button' onClick={onClose} style={{
            background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 10,
            color: 'rgba(255,255,255,0.5)', fontSize: 18, cursor: 'pointer', padding: '6px 12px',
          }}>x</button>
        </div>

        {/* Metadata URI */}
        <Field label='Metadata URI' hint='IPFS/Arweave link to agent profile'>
          <input
            type='text'
            value={form.metadataURI}
            onChange={(e) => setForm({ ...form, metadataURI: e.target.value })}
            placeholder='ipfs://Qm...'
            style={inputStyle}
          />
        </Field>

        {/* Category */}
        <Field label='Category'>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type='button'
                onClick={() => setForm({ ...form, category: cat.value })}
                style={{
                  padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: form.category === cat.value
                    ? '1px solid #f0b90b' : '1px solid rgba(255,255,255,0.06)',
                  background: form.category === cat.value
                    ? 'rgba(240,185,11,0.12)' : 'rgba(255,255,255,0.03)',
                  color: form.category === cat.value ? '#f0b90b' : 'rgba(255,255,255,0.5)',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Price */}
        <Field label='Price per Job (BNB)'>
          <input
            type='text'
            value={form.pricePerJob}
            onChange={(e) => setForm({ ...form, pricePerJob: e.target.value })}
            placeholder='0.001'
            style={inputStyle}
          />
        </Field>

        {/* Status */}
        {isPending && <StatusMsg color='#f0b90b'>Approving transaction in wallet...</StatusMsg>}
        {isConfirming && <StatusMsg color='#60a5fa'>Waiting for confirmation on-chain...</StatusMsg>}
        {isSuccess && <StatusMsg color='#00ffa3'>Agent registered on-chain! Token ID assigned.</StatusMsg>}
        {error && <StatusMsg color='#ef4444'>{error}</StatusMsg>}

        {/* Submit */}
        <button
          type='submit'
          disabled={isPending || isConfirming || !address}
          style={submitStyle(address)}
        >
          {!address ? 'Connect Wallet First'
            : isPending ? 'Signing...'
            : isConfirming ? 'Confirming...'
            : 'Register Agent On-Chain'}
        </button>
      </motion.form>
    </motion.div>
  )
}

// ─── Inline components below ───

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 6 }}>
        {label}
        {hint && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>({hint})</span>}
      </label>
      {children}
    </div>
  )
}

function StatusMsg({ children, color }) {
  return (
    <div style={{
      marginBottom: 16, padding: 12, borderRadius: 10,
      background: `${color}11`, border: `1px solid ${color}22`,
      fontSize: 12, color, display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {(color === '#f0b90b' || color === '#60a5fa') && (
        <span style={{
          width: 12, height: 12, border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: color, borderRadius: '50%', display: 'inline-block',
          animation: 'era-spin 0.7s linear infinite',
        }} />
      )}
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)',
  color: '#fff', fontSize: 13, outline: 'none',
}

function submitStyle(address) {
  return {
    width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
    background: address
      ? 'linear-gradient(135deg, #f0b90b 0%, #f8d33a 100%)'
      : 'rgba(255,255,255,0.05)',
    color: address ? '#0a0a0a' : 'rgba(255,255,255,0.4)',
    fontSize: 14, fontWeight: 800, cursor: 'pointer',
    boxShadow: address ? '0 4px 16px rgba(240,185,11,0.25)' : 'none',
  }
}
