import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

const BACKEND_URL = 'http://localhost:4174'

const STATUS_META = {
  OPEN: { label: 'Open', color: '#6b7280', desc: 'Job created, awaiting funding' },
  FUNDED: { label: 'Funded', color: '#fbbf24', desc: 'Payment escrowed on-chain' },
  SUBMITTED: { label: 'Executing', color: '#60a5fa', desc: 'Agent is processing' },
  COMPLETED: { label: 'Completed', color: '#00ffa3', desc: 'Result delivered' },
  REJECTED: { label: 'Rejected', color: '#ef4444', desc: 'Agent declined' },
  EXPIRED: { label: 'Expired', color: '#6b7280', desc: 'Job timed out' },
}

export default function JobTracker({ job, onClose }) {
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
          if (['COMPLETED', 'REJECTED', 'EXPIRED'].includes(data.job.status)) {
            clearInterval(pollRef.current)
          }
        }
      } catch {}
    }
    pollRef.current = setInterval(poll, 1000)
    return () => clearInterval(pollRef.current)
  }, [job?.jobId])

  if (!current) return null

  const meta = STATUS_META[current.status] || STATUS_META.OPEN
  const steps = ['OPEN', 'FUNDED', 'SUBMITTED', 'COMPLETED']
  const stepIdx = steps.indexOf(current.status)
  const isDone = ['COMPLETED', 'REJECTED', 'EXPIRED'].includes(current.status)

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: 20 }}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 150,
        width: 340,
        borderRadius: 16,
        background: 'rgba(15,15,15,0.97)',
        border: `1px solid ${meta.color}33`,
        padding: 20,
        backdropFilter: 'blur(16px)',
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${meta.color}11`,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 1, textTransform: 'uppercase' }}>
            Active Job
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginTop: 2 }}>
            {current.agent}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: 8,
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontSize: 16,
            padding: '4px 10px',
          }}
        >
          x
        </button>
      </div>

      {/* Progress steps */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        {steps.map((s, i) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i <= stepIdx ? meta.color : 'rgba(255,255,255,0.08)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      {/* Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 20,
          border: `1px solid ${meta.color}`,
          fontSize: 11,
          fontWeight: 600,
          color: meta.color,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />
          {meta.label}
        </span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{meta.desc}</span>
      </div>

      {/* Job details */}
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
        {current.jobId}
      </div>
      {current.txHash && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', marginTop: 4 }}>
          tx: {current.txHash.slice(0, 20)}...
        </div>
      )}

      {/* Result */}
      {current.status === 'COMPLETED' && current.result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 10,
            background: 'rgba(0,255,163,0.06)',
            border: '1px solid rgba(0,255,163,0.2)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#00ffa3', marginBottom: 6 }}>
            Result Delivered
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
            {current.result.summary}
          </div>
          {current.result.verifiable && (
            <div style={{ fontSize: 10, color: '#00ffa3', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00ffa3' }} />
              Verified on-chain · block {current.result.blockNumber}
            </div>
          )}
        </motion.div>
      )}

      {/* Spinner */}
      {!isDone && (
        <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 10,
            height: 10,
            border: '2px solid rgba(255,255,255,0.08)',
            borderTopColor: '#f0b90b',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'era-spin 0.7s linear infinite',
          }} />
          Polling every 1s...
        </div>
      )}
    </motion.div>
  )
}
