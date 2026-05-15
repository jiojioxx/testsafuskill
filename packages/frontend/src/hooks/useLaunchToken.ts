import { useState, useCallback, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { type Hex, parseEther } from 'viem';
import { useAccount } from 'wagmi';
import { useTranslation } from 'react-i18next';

const TREASURY_ADDRESS = '0xf4968dc4662a53278385e3af57fe82b86a864c8a' as Hex;

import {
  PORTAL_ABI,
  getPortalAddress,
  uploadMetadata,
  parseTokenMeta,
  findVanitySalt,
} from '@/lib/flap-portal';
import api from '@/lib/api';

type LaunchStep = 'idle' | 'uploading' | 'finding_salt' | 'confirming' | 'deploying' | 'buying' | 'success' | 'error';

interface LaunchState {
  step: LaunchStep;
  txHash?: Hex;
  tokenAddress?: string;
  error?: string;
  metaCid?: string;
  draftId?: string;
  initialBuyBnb?: number;
}

export interface LaunchTokenInput {
  name: string;
  symbol: string;
  description: string;
  imageFile?: File;
  skillId?: string;
  website?: string;
  twitter?: string;
  initialBuyBnb?: number;
  // 后端预创建的草稿 ID，用于后续状态同步
  draftId: string;
}

// 固定 1% 协议税，全部通过 Tax Splitter 分配给国库（mktBps=10000 → TOKEN_TAXED_V1 路径）
const FIXED_TAX_RATE = 100;   // 1% = 100 bps
const FIXED_MKT_BPS = 10000;  // 100% 税收进入 mkt（国库分配器）

// Tax Token V1 实现合约地址（mktBps == 10000 时走 TOKEN_TAXED_V1 路径）
const TAX_V1_IMPL = {
  56: '0x29e6383F0ce68507b5A72a53c2B118a118332aA8' as Hex,  // BNB 主网
  97: '0x87d8D03d0c3E064ACdb48E42fecbE8a8538dE6Fc' as Hex,  // BNB 测试网
} as const;

export function useLaunchToken() {
  const [state, setState] = useState<LaunchState>({ step: 'idle' });
  const chainId = useChainId();
  const { address: walletAddress } = useAccount();
  const { t } = useTranslation('launchpad');
  const { writeContractAsync } = useWriteContract();

  // 等待部署交易上链
  const { data: receipt } = useWaitForTransactionReceipt({
    hash: state.txHash,
  });

  // 当部署 tx receipt 到达时，提取 token 地址并触发初始买入（如有）
  useEffect(() => {
    if (!receipt || state.step !== 'deploying' || !state.txHash) return;

    const portalAddress = getPortalAddress(chainId).toLowerCase();

    // 策略1：从 TokenCreated 事件提取 token 地址（topics[2] 是 indexed token 地址）
    let tokenAddress: string | undefined;
    for (const log of receipt.logs) {
      if (log.address?.toLowerCase() === portalAddress && log.topics.length >= 3) {
        const raw = log.topics[2];
        if (raw) {
          tokenAddress = '0x' + raw.slice(-40);
          console.log('[useLaunchToken] TokenCreated event found, token:', tokenAddress);
          break;
        }
      }
    }

    // 策略2：vanity 后缀匹配（tax token 以 7777 结尾）
    if (!tokenAddress) {
      for (const log of receipt.logs) {
        const addr = log.address?.toLowerCase();
        if (addr && (addr.endsWith('8888') || addr.endsWith('7777'))) {
          tokenAddress = log.address;
          console.log('[useLaunchToken] Vanity suffix match, token:', tokenAddress);
          break;
        }
      }
    }

    // 策略3：第一个非 portal 的合约地址
    if (!tokenAddress) {
      for (const log of receipt.logs) {
        if (log.address && log.address.toLowerCase() !== portalAddress && log.topics[0]) {
          tokenAddress = log.address;
          console.log('[useLaunchToken] Fallback: first non-portal log address, token:', tokenAddress);
          break;
        }
      }
    }

    if (!tokenAddress) {
      console.error('[useLaunchToken] Could not extract token address from receipt', receipt);
      setState((s) => ({ ...s, step: 'error', error: 'Could not extract token address from receipt' }));
      return;
    }

    const capturedToken = tokenAddress;
    const capturedState = state;

    // 更新后端 token 地址 + 图片（异步，不阻塞 UI）
    const updateBackend = (addr: string) => {
      if (!capturedState.draftId) return;
      const updateData: Record<string, string> = { tokenAddress: addr, txHash: capturedState.txHash! };
      if (capturedState.metaCid) {
        parseTokenMeta(capturedState.metaCid)
          .then((meta) => { if (meta.image) updateData.imageUrl = meta.image; })
          .catch(() => {})
          .finally(() => {
            api.put(`/tokens/${capturedState.draftId}/deployed`, updateData).catch((e) => {
              console.error('[useLaunchToken] Failed to update backend deployed status', e);
            });
          });
      } else {
        api.put(`/tokens/${capturedState.draftId}/deployed`, updateData).catch((e) => {
          console.error('[useLaunchToken] Failed to update backend deployed status', e);
        });
      }
    };

    if (capturedState.initialBuyBnb && capturedState.initialBuyBnb > 0) {
      // 有初始买入：先切换到 buying 步骤，再发起 swapExactInput
      setState((s) => ({ ...s, step: 'buying', tokenAddress: capturedToken }));
      const portalAddr = getPortalAddress(chainId);
      const ZERO = '0x0000000000000000000000000000000000000000' as Hex;
      const buyAmount = capturedState.initialBuyBnb;

      console.log('[useLaunchToken] Initiating initial buy, bnb:', buyAmount, 'token:', capturedToken);

      writeContractAsync({
        address: portalAddr,
        abi: PORTAL_ABI,
        functionName: 'swapExactInput',
        args: [{
          inputToken: ZERO,
          outputToken: capturedToken as Hex,
          inputAmount: parseEther(buyAmount.toString()),
          minOutputAmount: 0n,  // 无滑点保护，合约负责 max buy 和退款
          permitData: '0x' as Hex,
        }],
        value: parseEther(buyAmount.toString()),
      })
        .then((buyTxHash) => {
          console.log('[useLaunchToken] Initial buy tx submitted:', buyTxHash);
          // 买入 tx 提交即视为成功（合约保证退款），不等待 receipt
          setState((s) => ({ ...s, step: 'success', tokenAddress: capturedToken }));
          updateBackend(capturedToken);
        })
        .catch((err) => {
          // 买入失败不影响代币部署，仍然标记 success
          console.warn('[useLaunchToken] Initial buy failed (token still deployed):', err?.shortMessage || err?.message);
          setState((s) => ({ ...s, step: 'success', tokenAddress: capturedToken }));
          updateBackend(capturedToken);
        });
    } else {
      // 无初始买入，直接标记成功
      setState((s) => ({ ...s, step: 'success', tokenAddress: capturedToken }));
      updateBackend(capturedToken);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt]);

  const launch = useCallback(
    async (input: LaunchTokenInput) => {
      try {
        // Step 1: 上传元数据到 IPFS
        console.log('[useLaunchToken] Step 1: Uploading metadata to IPFS...');
        setState({ step: 'uploading' });
        const metaCid = await uploadMetadata(
          input.name,
          input.symbol,
          input.description,
          input.imageFile,
          input.website,
          input.twitter,
        );
        console.log('[useLaunchToken] Metadata uploaded, CID:', metaCid);
        setState((s) => ({ ...s, metaCid }));

        // 固定使用 tax token（1% 税率，全部进入国库分配器）
        const cid = chainId as 56 | 97;
        const portalAddress = getPortalAddress(chainId);
        const tokenImpl: Hex = TAX_V1_IMPL[cid];

        if (!tokenImpl) {
          throw new Error(`Unsupported chainId for tax token: ${chainId}`);
        }

        // Step 2: 计算 vanity salt（tax token 以 7777 结尾）
        console.log('[useLaunchToken] Step 2: Finding vanity salt (suffix: 7777)...');
        setState({ step: 'finding_salt' });
        const salt = await findVanitySalt(portalAddress, tokenImpl, '7777');
        console.log('[useLaunchToken] Vanity salt found:', salt);

        // Step 3: 部署 tax token（newTokenV5）
        console.log('[useLaunchToken] Step 3: Deploying tax token via newTokenV5...');
        const ZERO = '0x0000000000000000000000000000000000000000' as Hex;
        const ZERO32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;
        const txHash = await writeContractAsync({
          address: portalAddress,
          abi: PORTAL_ABI,
          functionName: 'newTokenV5',
          args: [{
            name: input.name,
            symbol: input.symbol,
            meta: metaCid,
            dexThresh: 1,
            salt,
            taxRate: FIXED_TAX_RATE,       // 100 = 1%
            migratorType: 1,               // V2_MIGRATOR（tax token 必须用 1）
            quoteToken: ZERO,              // address(0) = 原生 BNB
            quoteAmt: 0n,
            beneficiary: TREASURY_ADDRESS, // 税收受益人 = 国库（Tax Splitter 负责二次分配）
            permitData: '0x' as Hex,
            extensionID: ZERO32,
            extensionData: '0x' as Hex,
            dexId: 0,                      // PancakeSwap
            lpFeeProfile: 0,
            taxDuration: 3153600000n,      // ~100 年（永久税）
            antiFarmerDuration: 259200n,   // 3 天防狙击
            mktBps: FIXED_MKT_BPS,         // 10000 = 100% 税收进入 mkt
            deflationBps: 0,
            dividendBps: 0,
            lpBps: 0,
            minimumShareBalance: 10000000000000000000000n, // 持股分红最低门槛：10000 tokens
          } as any],
        });

        console.log('[useLaunchToken] Deploy tx submitted:', txHash);

        // 保存部署状态（receipt 到达后由 useEffect 处理后续逻辑）
        setState({
          step: 'deploying',
          txHash,
          metaCid,
          draftId: input.draftId,
          initialBuyBnb: input.initialBuyBnb,
        });

        // 通知后端 tx 已提交
        await api.put(`/tokens/${input.draftId}/deploying`, { txHash }).catch((e) => {
          console.warn('[useLaunchToken] Failed to notify backend of deploying status:', e?.message);
        });

        return txHash;
      } catch (err: any) {
        const errorMsg = err?.shortMessage || err?.message || t('create.toast.transactionFailed');
        console.error('[useLaunchToken] Launch failed:', errorMsg, err);
        setState({ step: 'error', error: errorMsg });

        // 通知后端标记失败（使用 input.draftId 而非 state.draftId，避免 stale closure）
        if (input.draftId) {
          await api.put(`/tokens/${input.draftId}/failed`).catch(() => {});
        }

        throw err;
      }
    },
    [chainId, walletAddress, writeContractAsync, t],
  );

  const reset = useCallback(() => {
    setState({ step: 'idle' });
  }, []);

  return {
    ...state,
    launch,
    reset,
    receipt,
  };
}
