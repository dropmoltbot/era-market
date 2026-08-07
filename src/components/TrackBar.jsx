import { motion } from 'framer-motion'
import { categoryMeta, categoryOrder } from '../lib/agents'

export default function TrackBar({ active, counts, onSelect }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        marginTop: 24,
      }}
    >
      {categoryOrder.map((key, i) => {
        const meta = categoryMeta[key]
        const count = counts[key] || 0
        const isActive = active === key
        return (
          <motion.button
            key={key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.05, duration: 0.3 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect(isActive ? 'all' : key)}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              border: `1px solid ${isActive ? meta.color : 'rgba(255,255,255,0.08)'}`,
              background: isActive
                ? `linear-gradient(135deg, ${meta.color}22 0%, ${meta.color}08 100%)`
                : 'rgba(255,255,255,0.03)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backdropFilter: 'blur(10px)',
              transition: 'border 0.2s',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: meta.color,
                boxShadow: isActive ? `0 0 8px ${meta.color}` : 'none',
              }}
            />
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
            }}>
              {meta.label}
            </span>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: isActive ? meta.color : 'rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.05)',
              padding: '2px 8px',
              borderRadius: 8,
            }}>
              {count}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
