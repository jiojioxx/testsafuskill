import { useState, useCallback } from 'react';
import { useWriteContract, useChainId, usePublicClient } from 'wagmi';
import { useAccount, useSignMessage } from 'wagmi';
import { type Hex } from 'viem';
import {
  checkFourMemeToken,
  getFourMemeNonce,
  loginFourMeme,
  uploadFourMemeImage,
  getFourMemeSignature,
} from '@/lib/fourmeme-api';
import { TokenManager2_ABI, TOKEN_MANAGER_2 } from '@/lib/fourmeme-contracts';
import api from '@/lib/api';

export type FourMemeStep =
  | 'idle'
  | 'signing'
  | 'uploading_image'
  | 'getting_signature'
  | 'deploying'
  | 'confirming'
  | 'success'
  | 'error';

interface FourMemeState {
  step: FourMemeStep;
  txHash?: Hex;
  tokenAddress?: string;
  imageUrl?: string;
  error?: string;
  draftId?: string;
}

export interface FourMemeLaunchInput {
  name: string;
  symbol: string;
  description: string;
  imageFile?: File;
  skillId: string;
  website?: string;
  twitter?: string;
  draftId: string;
}

export function useLaunchFourMeme() {
  const [state, setState] = useState<FourMemeState>({ step: 'idle' });
  const chainId = useChainId();
  const { address: walletAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();
  const publicClient = usePublicClient({ chainId: 56 });

  const launch = useCallback(
    async (input: FourMemeLaunchInput) => {
      if (!walletAddress) throw new Error('Wallet not connected');

      try {
        console.info('[useLaunchFourMeme] launch:start', {
          draftId: input.draftId,
          walletAddress,
          symbol: input.symbol,
          hasImage: !!input.imageFile,
        });
        setState({ step: 'signing', draftId: input.draftId });

        const hasToken = await checkFourMemeToken();
        console.info('[useLaunchFourMeme] token:check', { draftId: input.draftId, valid: hasToken });
        if (!hasToken) {
          const nonce = await getFourMemeNonce(walletAddress);
          console.info('[useLaunchFourMeme] token:nonce', { draftId: input.draftId, nonce });
          const signature = await signMessageAsync({
            message: `You are sign in Meme ${nonce}`,
          });
          console.info('[useLaunchFourMeme] token:signed', { draftId: input.draftId, signatureLength: signature.length });
          await loginFourMeme(walletAddress, signature, nonce);
          console.info('[useLaunchFourMeme] token:login:ok', { draftId: input.draftId });
        }

        setState((s) => ({ ...s, step: 'uploading_image' }));
        let imageUrl = '';
        if (input.imageFile) {
          console.info('[useLaunchFourMeme] image:upload:start', {
            draftId: input.draftId,
            name: input.imageFile.name,
            size: input.imageFile.size,
            type: input.imageFile.type,
          });
          imageUrl = await uploadFourMemeImage(input.imageFile);
          console.info('[useLaunchFourMeme] image:upload:ok', { draftId: input.draftId, imageUrl });
        }
        setState((s) => ({ ...s, imageUrl }));

        setState((s) => ({ ...s, step: 'getting_signature' }));
        console.info('[useLaunchFourMeme] signature:start', { draftId: input.draftId, symbol: input.symbol, imageUrl });
        const { createArg, signature } = await getFourMemeSignature({
          name: input.name,
          symbol: input.symbol,
          description: input.description,
          imgUrl: imageUrl,
          website: input.website,
          twitter: input.twitter,
        });
        console.info('[useLaunchFourMeme] signature:ok', {
          draftId: input.draftId,
          createArgLength: createArg.length,
          signatureLength: signature.length,
        });

        setState((s) => ({ ...s, step: 'deploying' }));
        const txHash = await writeContractAsync({
          address: TOKEN_MANAGER_2,
          abi: TokenManager2_ABI,
          functionName: 'createToken',
          args: [createArg as Hex, signature as Hex],
          value: 0n,
        });
        console.info('[useLaunchFourMeme] deploy:submitted', { draftId: input.draftId, txHash });

        setState((s) => ({ ...s, step: 'confirming', txHash }));

        const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
        console.info('[useLaunchFourMeme] deploy:confirmed', {
          draftId: input.draftId,
          txHash,
          blockNumber: receipt.blockNumber.toString(),
          logs: receipt.logs.length,
        });

        let tokenAddress: string | undefined;
        for (const log of receipt.logs) {
          const addr = log.address?.toLowerCase();
          if (addr && addr.endsWith('4444')) {
            tokenAddress = log.address;
            break;
          }
        }
        if (!tokenAddress) {
          for (const log of receipt.logs) {
            if (
              log.address &&
              log.address.toLowerCase() !== TOKEN_MANAGER_2.toLowerCase() &&
              log.topics[0]
            ) {
              tokenAddress = log.address;
              break;
            }
          }
        }

        if (!tokenAddress) {
          console.error('[useLaunchFourMeme] deploy:extract-token-failed', { draftId: input.draftId, txHash, logs: receipt.logs });
          throw new Error('Could not extract token address from receipt');
        }
        console.info('[useLaunchFourMeme] deploy:token-extracted', { draftId: input.draftId, tokenAddress });

        await api
          .put(`/tokens/${input.draftId}/deployed`, {
            tokenAddress,
            txHash,
            imageUrl: imageUrl || undefined,
            blockNumber: receipt.blockNumber.toString(),
          })
          .then(() => {
            console.info('[useLaunchFourMeme] backend:update-deployed:ok', {
              draftId: input.draftId,
              tokenAddress,
              txHash,
            });
          })
          .catch((e) => console.error('[useLaunchFourMeme] Failed to update backend:', e));

        console.info('[useLaunchFourMeme] launch:success', { draftId: input.draftId, tokenAddress, txHash });
        setState((s) => ({ ...s, step: 'success', tokenAddress }));
      } catch (err: any) {
        const msg = err?.shortMessage || err?.message || 'Launch failed';
        console.error('[useLaunchFourMeme] launch:error', {
          draftId: input.draftId,
          step: state.step,
          message: msg,
          raw: err,
        });
        setState((s) => ({ ...s, step: 'error', error: msg }));
        throw err;
      }
    },
    [walletAddress, writeContractAsync, signMessageAsync, publicClient],
  );

  const reset = useCallback(() => setState({ step: 'idle' }), []);

  return {
    step: state.step,
    txHash: state.txHash,
    tokenAddress: state.tokenAddress,
    error: state.error,
    draftId: state.draftId,
    launch,
    reset,
  };
}
