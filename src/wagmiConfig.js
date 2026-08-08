import '@rainbow-me/rainbowkit/styles.css'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { bsc } from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: 'ERA Market',
  projectId: 'era-market-bnb-hackathon',
  chains: [bsc],
  ssr: false,
  // Use publicnode RPC which has CORS headers enabled
  transports: {
    [bsc.id]: 'https://bsc-dataseed.bnbchain.org',
  },
})

export { bsc }
