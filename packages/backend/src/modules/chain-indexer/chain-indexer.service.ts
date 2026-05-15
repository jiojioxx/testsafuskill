import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

// ─── 合约常量 ──────────────────────────────────────────────────────────────

const PORTAL_ADDRESS = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0';
const TOKEN_MANAGER_2 = '0x5c952063c7fc8610ffdb798152d69f0b9550762b';
const CHAIN_ID = 56;
const BSC_RPC = process.env.BSC_RPC_URL || 'https://api.zan.top/node/v1/bsc/mainnet/1a1bd0f2fd784bfda2442caa24324fe6';

// Portal 部署区块（从此块开始索引，避免全链扫描）
const GENESIS_BLOCK = 45_000_000n;

// 每次处理的区块数
const BATCH_SIZE = 2000n;

// 轮询间隔 ms
const POLL_INTERVAL_MS = 3_000;

// ─── Event topic（从真实链上交易日志提取的正确 keccak256 hash）────────────
//
// 验证方式：通过 eth_getTransactionReceipt 拿到真实 log.topics[0]
// 所有 Flap Portal 事件均为 非-indexed（topics 数组只有 topic[0]），
// 全部参数都编码在 log.data 中。
//
// TokenCreated(uint256 ts, address creator, uint256 nonce, address token, string name, string symbol, string meta)
//   from tx 0xa51431b683e0fd56f5207f387b49249618ebba62c794115ef84af83096ca502b
const TOPIC_TOKEN_CREATED   = '0x504e7f360b2e5fe33cbaaae4c593bc55305328341bf79009e43e0e3b7f699603';

// FlapTokenCirculatingSupplyChanged(address token, uint256 newSupply)
//   from tx 0x834142c46093416d01e47a7369bf99a11957ea494e46afec4b8c7f4138f70ada
const TOPIC_SUPPLY_CHANGED  = '0x115c78ad17c4763fb97bca94f3e59dc8cb2e59c9d3862f24a694ec401200f562';

// TokenBought(uint256 ts, address token, address buyer, uint256 amount, uint256 eth, uint256 fee, uint256 postPrice)
//   from tx 0x834142c46093416d01e47a7369bf99a11957ea494e46afec4b8c7f4138f70ada
const TOPIC_TOKEN_BOUGHT    = '0xa800a2038683844fac66747f771bfdfae862eb28b16bcfa387afa9fbacce8ff7';

// TokenSold(uint256 ts, address token, address seller, uint256 amount, uint256 eth, uint256 fee, uint256 postPrice)
//   confirmed from chain scan: dataWords=7, same structure as TokenBought
const TOPIC_TOKEN_SOLD      = '0x03a4693e592f5e75dc7c136acb39b146d2b4966c0e509c34f362dee02b3b861a';

// four.meme TokenPurchase(address,address,uint256,uint256,uint256,uint256,uint256,uint256)
const TOPIC_FM_TOKEN_PURCHASE = '0x7db52723a3b2cdd6164364b3b766e65e540d7be48ffa89582956d8eaebe62942';

// four.meme TokenSale(address,address,uint256,uint256,uint256,uint256,uint256,uint256)
const TOPIC_FM_TOKEN_SALE = '0x0a5575b3648bae2210cee56bf33254cc1ddfbc7bf637c0af2ac18b14fb1bae19';

// four.meme LiquidityAdded(address,uint256,address,uint256)
const TOPIC_FM_LIQUIDITY_ADDED = '0xc18aa71171b358b706fe3dd345299685ba21a5316c66ffa9e319268b033c44b0';

// ─── 轻量 JSON-RPC 封装 ──────────────────────────────────────────────────

let rpcId = 0;

async function rpcCall(method: string, params: any[]): Promise<any> {
  const id = ++rpcId;
  const res = await fetch(BSC_RPC, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // ZAN RPC 需要 Origin 头做域名校验，后端请求需手动指定
      ...(process.env.FRONTEND_URL ? { 'Origin': process.env.FRONTEND_URL } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = await res.json() as any;
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result;
}

/** eth_blockNumber → bigint */
async function getBlockNumber(): Promise<bigint> {
  const hex: string = await rpcCall('eth_blockNumber', []);
  return BigInt(hex);
}

async function getBlockTimestamp(blockNumberHex: string): Promise<bigint> {
  const block = await rpcCall('eth_getBlockByNumber', [blockNumberHex, false]);
  return hexToBigInt(block?.timestamp || '0x0');
}

/** eth_getLogs → raw log array，失败时自动对半拆分重试 */
async function getLogs(params: {
  address: string;
  topics: (string | string[] | null)[];
  fromBlock: string;
  toBlock: string;
}): Promise<any[]> {
  try {
    return await rpcCall('eth_getLogs', [params]) as any[];
  } catch (err: any) {
    const msg: string = err?.message || '';
    // limit exceeded / block range too large → 对半拆分
    if (
      msg.includes('limit exceeded') ||
      msg.includes('block range') ||
      msg.includes('too many') ||
      msg.includes('eth_getLogs')
    ) {
      const from = BigInt(params.fromBlock);
      const to   = BigInt(params.toBlock);
      if (to - from < 2n) throw err; // 已经最小，无法再拆
      const mid = from + (to - from) / 2n;
      const [a, b] = await Promise.all([
        getLogs({ ...params, fromBlock: '0x' + from.toString(16), toBlock: '0x' + mid.toString(16) }),
        getLogs({ ...params, fromBlock: '0x' + (mid + 1n).toString(16), toBlock: '0x' + to.toString(16) }),
      ]);
      return [...a, ...b];
    }
    throw err;
  }
}

/** hex string (with or without 0x) → bigint */
function hexToBigInt(hex: string): bigint {
  if (!hex || hex === '0x') return 0n;
  return BigInt(hex.startsWith('0x') || hex.startsWith('0X') ? hex : '0x' + hex);
}

/** 18 位小数 wei → 浮点字符串（保留精度）*/
function formatEther18(wei: bigint): string {
  if (wei === 0n) return '0';
  const s = wei.toString().padStart(19, '0');
  const int = s.slice(0, -18) || '0';
  const dec = s.slice(-18).replace(/0+$/, '');
  return dec ? `${int}.${dec}` : int;
}

/** ABI decode：从 data hex 取第 n 个 uint256 slot (0-indexed) */
function decodeUint256Slot(data: string, slotIndex: number): bigint {
  const clean = data.startsWith('0x') ? data.slice(2) : data;
  const slot = clean.slice(slotIndex * 64, (slotIndex + 1) * 64);
  if (!slot || slot.length < 64) return 0n;
  return BigInt('0x' + slot);
}

/** ABI decode：从 data hex 取第 n 个 address slot（取后 20 字节）*/
function decodeAddressSlot(data: string, slotIndex: number): string {
  const clean = data.startsWith('0x') ? data.slice(2) : data;
  const slot = clean.slice(slotIndex * 64, (slotIndex + 1) * 64);
  if (!slot || slot.length < 64) return '';
  return '0x' + slot.slice(24).toLowerCase();
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class ChainIndexerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ChainIndexerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    this.scheduleNextTick();
  }

  private scheduleNextTick() {
    this.timer = setTimeout(() => this.tick(), POLL_INTERVAL_MS);
  }

  private async tick() {
    if (this.running) {
      this.scheduleNextTick();
      return;
    }
    this.running = true;
    try {
      await this.indexNextBatch();
    } catch (err: any) {
      this.logger.error('Chain indexer tick failed: ' + (err?.message || err));
    } finally {
      this.running = false;
      this.scheduleNextTick();
    }
  }

  private async indexNextBatch() {
    // 加载或初始化 indexer 状态
    let state = await this.prisma.chainIndexerState.findUnique({
      where: { chainId: CHAIN_ID },
    });
    if (!state) {
      state = await this.prisma.chainIndexerState.create({
        data: { chainId: CHAIN_ID, lastIndexedBlock: GENESIS_BLOCK },
      });
    }

    const fromBlock = state.lastIndexedBlock + 1n;
    const latestBlock = await getBlockNumber();

    if (fromBlock > latestBlock) return;

    const toBlock =
      fromBlock + BATCH_SIZE - 1n < latestBlock
        ? fromBlock + BATCH_SIZE - 1n
        : latestBlock;

    this.logger.debug(`Indexing blocks ${fromBlock}–${toBlock}`);

    const fromHex = '0x' + fromBlock.toString(16);
    const toHex   = '0x' + toBlock.toString(16);

    // 只处理平台发布的 token（gh_token_launches 表中有 token_address 的记录）
    const platformLaunches = await this.prisma.tokenLaunch.findMany({
      where: { tokenAddress: { not: null } },
      select: { tokenAddress: true },
    });
    const platformTokenSet = new Set(
      platformLaunches
        .map((l) => l.tokenAddress?.toLowerCase())
        .filter(Boolean) as string[],
    );

    if (platformTokenSet.size === 0) {
      // 平台暂无已上链的 token，推进游标后直接返回
      await this.prisma.chainIndexerState.update({
        where: { chainId: CHAIN_ID },
        data: { lastIndexedBlock: toBlock },
      });
      return;
    }

    // 拉取 Portal 地址的所有事件（不过滤 topic[0]，用 null 取全部）
    // 链上所有 Flap Portal 事件只有 1 个 topic（即事件签名 hash），
    // 全部参数均在 data 中，不使用 indexed 参数。
    let allLogs: any[] = [];
    let fourMemeLogs: any[] = [];
    try {
      [allLogs, fourMemeLogs] = await Promise.all([
        getLogs({
          address: PORTAL_ADDRESS,
          topics: [null],   // 不按 topic 过滤，取 Portal 所有事件
          fromBlock: fromHex,
          toBlock: toHex,
        }),
        getLogs({
          address: TOKEN_MANAGER_2,
          topics: [[TOPIC_FM_TOKEN_PURCHASE, TOPIC_FM_TOKEN_SALE, TOPIC_FM_LIQUIDITY_ADDED]],
          fromBlock: fromHex,
          toBlock: toHex,
        }),
      ]);
    } catch (err: any) {
      this.logger.warn(`getLogs failed: ${err?.message}`);
      return;
    }

    // ── 第一遍：按 topic0 分类 ─────────────────────────────────────────

    // supply 变化 map: txHash → { tokenAddress, newSupply }
    const supplyByTx = new Map<string, { tokenAddress: string; newSupply: bigint }>();

    // trade logs (bought + sold)
    const tradeLogs: Array<{ log: any; isBuy: boolean; source: 'flap' | 'fourmeme' }> = [];

    // token created logs
    const createdLogs: any[] = [];

    for (const log of allLogs) {
      const topic0: string = (log.topics?.[0] || '').toLowerCase();
      const data: string   = log.data || '0x';

      // ── FlapTokenCirculatingSupplyChanged ──────────────────────────
      // data[0] = token address (address 编码为 32 bytes)
      // data[1] = newSupply (uint256)
      if (topic0 === TOPIC_SUPPLY_CHANGED) {
        const tokenAddress = decodeAddressSlot(data, 0);
        if (!platformTokenSet.has(tokenAddress)) continue;  // 非平台 token 跳过
        const newSupply    = decodeUint256Slot(data, 1);
        const txHash       = (log.transactionHash as string).toLowerCase();
        if (tokenAddress && newSupply > 0n) {
          supplyByTx.set(txHash, { tokenAddress, newSupply });
        }
        continue;
      }

      // ── TokenBought ────────────────────────────────────────────────
      // data[0]=ts, data[1]=token, data[2]=buyer,
      // data[3]=amount, data[4]=eth, data[5]=fee, data[6]=postPrice
      if (topic0 === TOPIC_TOKEN_BOUGHT) {
        const tokenAddress = decodeAddressSlot(data, 1);
        if (!platformTokenSet.has(tokenAddress)) continue;  // 非平台 token 跳过
        tradeLogs.push({ log, isBuy: true, source: 'flap' });
        continue;
      }

      // ── TokenSold ──────────────────────────────────────────────────
      // data[0]=ts, data[1]=token, data[2]=seller,
      // data[3]=amount, data[4]=eth, data[5]=fee, data[6]=postPrice
      if (topic0 === TOPIC_TOKEN_SOLD) {
        const tokenAddress = decodeAddressSlot(data, 1);
        if (!platformTokenSet.has(tokenAddress)) continue;  // 非平台 token 跳过
        tradeLogs.push({ log, isBuy: false, source: 'flap' });
        continue;
      }

      // ── TokenCreated ───────────────────────────────────────────────
      // data[0]=ts, data[1]=creator, data[2]=nonce, data[3]=token,
      // data[4+]=name/symbol/meta (ABI 动态字符串编码)
      if (topic0 === TOPIC_TOKEN_CREATED) {
        const tokenAddress = decodeAddressSlot(data, 3);
        if (!platformTokenSet.has(tokenAddress)) continue;  // 非平台 token 跳过
        createdLogs.push(log);
        continue;
      }
    }

    const fourMemeTradeBlockSet = new Set<string>();
    for (const log of fourMemeLogs) {
      const topic0: string = (log.topics?.[0] || '').toLowerCase();
      const data: string = log.data || '0x';

      if (topic0 === TOPIC_FM_TOKEN_PURCHASE || topic0 === TOPIC_FM_TOKEN_SALE) {
        const tokenAddress = decodeAddressSlot(data, 0);
        if (!platformTokenSet.has(tokenAddress)) continue;
        tradeLogs.push({ log, isBuy: topic0 === TOPIC_FM_TOKEN_PURCHASE, source: 'fourmeme' });
        if (log.blockNumber) fourMemeTradeBlockSet.add(log.blockNumber as string);
      }
    }

    const fourMemeBlockTsMap = new Map<string, bigint>();
    await Promise.all(
      Array.from(fourMemeTradeBlockSet).map(async (blockNumHex) => {
        const ts = await getBlockTimestamp(blockNumHex);
        fourMemeBlockTsMap.set(blockNumHex, ts);
      }),
    );

    // ── 第二遍：处理 trade logs ────────────────────────────────────────

    let tradeCount = 0;

    for (const { log, isBuy, source } of tradeLogs) {
      const txHash = (log.transactionHash as string).toLowerCase();
      const data: string = log.data || '0x';
      const blockNumber: bigint = hexToBigInt(log.blockNumber);

      let tokenAddress = '';
      let blockTs = 0n;
      let tokenAmount = 0n;
      let bnbAmount = 0n;
      let postPrice = 0n;
      let newSupply = 0n;

      if (source === 'flap') {
        // data[0]=ts(链上时间戳秒), data[1]=token, data[2]=buyer/seller
        // data[3]=tokenAmount, data[4]=bnbAmount, data[5]=fee, data[6]=postPrice
        tokenAddress = decodeAddressSlot(data, 1);
        if (!tokenAddress) continue;

        blockTs = decodeUint256Slot(data, 0);
        tokenAmount = decodeUint256Slot(data, 3);
        bnbAmount = decodeUint256Slot(data, 4);
        postPrice = decodeUint256Slot(data, 6);

        const supplyInfo = supplyByTx.get(txHash);
        newSupply = supplyInfo?.newSupply ?? 0n;
      } else {
        // data[0]=token, data[1]=account, data[2]=price, data[3]=amount,
        // data[4]=cost, data[5]=fee, data[6]=offers, data[7]=funds
        tokenAddress = decodeAddressSlot(data, 0);
        if (!tokenAddress) continue;

        blockTs = fourMemeBlockTsMap.get(log.blockNumber as string) ?? 0n;
        postPrice = decodeUint256Slot(data, 2);
        tokenAmount = decodeUint256Slot(data, 3);
        bnbAmount = decodeUint256Slot(data, 4);
        newSupply = decodeUint256Slot(data, 6);
      }

      await this.prisma.onChainToken
        .upsert({
          where: { tokenAddress },
          create: {
            tokenAddress,
            chainId: CHAIN_ID,
            creator: '',
            name: '',
            symbol: '',
            createdBlock: blockNumber,
          },
          update: {},
        })
        .catch(() => {});

      await this.prisma.tokenTrade
        .upsert({
          where: { txHash_isBuy: { txHash, isBuy } },
          create: {
            tokenAddress,
            chainId: CHAIN_ID,
            blockNumber,
            txHash,
            isBuy,
            tokenAmount: formatEther18(tokenAmount),
            bnbAmount:   formatEther18(bnbAmount),
            priceRaw:    formatEther18(postPrice),
            supplyRaw:   formatEther18(newSupply),
            blockTs,
          },
          update: {},
        })
        .catch((e: any) => this.logger.warn(`upsert trade ${txHash} failed: ${e?.message}`));

      tradeCount++;
    }

    // ── 第三遍：处理 TokenCreated ──────────────────────────────────────

    let createdCount = 0;
    for (const log of createdLogs) {
      const data: string = log.data || '0x';
      // data[1] = creator address, data[3] = token address
      const creator      = decodeAddressSlot(data, 1);
      const tokenAddress = decodeAddressSlot(data, 3);
      if (!tokenAddress) continue;

      const blockNumber: bigint = hexToBigInt(log.blockNumber);

      await this.prisma.onChainToken
        .upsert({
          where: { tokenAddress },
          create: {
            tokenAddress,
            chainId: CHAIN_ID,
            creator,
            name: '',
            symbol: '',
            createdBlock: blockNumber,
          },
          update: { creator },
        })
        .catch(() => {});
      createdCount++;
    }

    // 推进游标
    await this.prisma.chainIndexerState.update({
      where: { chainId: CHAIN_ID },
      data: { lastIndexedBlock: toBlock },
    });

    if (createdCount > 0 || tradeCount > 0) {
      this.logger.log(
        `Blocks ${fromBlock}–${toBlock}: ${createdCount} tokens created, ${tradeCount} trades`,
      );
    }
  }

  /** 给 API 使用：返回某 token 的历史交易价格点 */
  async getTradesForToken(
    tokenAddress: string,
    limit = 500,
  ): Promise<{
    blockNumber: string;
    blockTs: string;
    isBuy: boolean;
    tokenAmount: string;
    bnbAmount: string;
    priceRaw: string;
    supplyRaw: string;
    txHash: string;
  }[]> {
    const rows = await this.prisma.tokenTrade.findMany({
      where: { tokenAddress: tokenAddress.toLowerCase() },
      orderBy: { blockTs: 'desc' },
      take: limit,
      select: {
        blockNumber: true,
        blockTs: true,
        isBuy: true,
        tokenAmount: true,
        bnbAmount: true,
        priceRaw: true,
        supplyRaw: true,
        txHash: true,
      },
    });

    return rows.map((r) => ({
      blockNumber: r.blockNumber.toString(),
      blockTs:     r.blockTs.toString(),
      isBuy:       r.isBuy,
      tokenAmount: r.tokenAmount,
      bnbAmount:   r.bnbAmount,
      priceRaw:    r.priceRaw,
      supplyRaw:   r.supplyRaw,
      txHash:      r.txHash,
    }));
  }
}
