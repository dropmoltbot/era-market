import { ConnectButton } from '@rainbow-me/rainbowkit'
import { motion } from 'framer-motion'

export default function Header() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(20px) saturate(180%)',
        background: 'rgba(10,10,10,0.72)',
        borderBottom: '1px solid rgba(240,185,11,0.12)',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          style={{ display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #f0b90b 0%, #f8d33a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 900,
              color: '#0a0a0a',
              boxShadow: '0 4px 12px rgba(240,185,11,0.3)',
            }}
          >
            E
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
              ERA Market
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>
              BNB Agent Marketplace
            </div>
          </div>
        </motion.div>

        <ConnectButton
          showBalance={false}
          chainStatus={{ smallScreen: 'icon', largeScreen: 'full' }}
          label='Connect Wallet'
        />
      </div>
    </header>
  )
}
