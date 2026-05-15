import { http, fallback } from 'wagmi';
import { bsc, mainnet, polygon, arbitrum, optimism, base } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

export const wagmiConfig = getDefaultConfig({
  appName: 'SafuSkill',
  projectId: (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [bsc, mainnet, polygon, arbitrum, optimism, base],
  transports: {
    [bsc.id]: fallback([
      http('https://api.zan.top/node/v1/bsc/mainnet/1a1bd0f2fd784bfda2442caa24324fe6'),
    ]),
    [mainnet.id]: http('https://eth.drpc.org'),
    [polygon.id]: http('https://polygon-rpc.com'),
    [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
    [optimism.id]: http('https://mainnet.optimism.io'),
    [base.id]: http('https://mainnet.base.org'),
  },
});
