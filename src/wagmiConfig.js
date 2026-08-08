import '@rainbow-me/rainbowkit/styles.css'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { bsc } from 'wagmi/chains'
import { http } from 'wagmi'

export const config = getDefaultConfig({
  appName: 'ERA Market',
  projectId: 'era-market-bnb-hackathon',
  chains: [bsc],
  ssr: false,
  transports: {
    [bsc.id]: http('https://bsc-dataseed.bnbchain.org'),
  },
})

export { bsc }
