import '@rainbow-me/rainbowkit/styles.css'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { bsc } from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: 'ERA Market',
  projectId: 'era-market-bnb-hackathon',
  chains: [bsc],
  ssr: false,
})

export { bsc }
