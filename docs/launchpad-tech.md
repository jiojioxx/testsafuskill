# 技术文档 — SafuSkill 技能发射台页面

## 1. 路由

| 路径 | 组件 | 说明 |
|---|---|---|
| `/launchpad` | `LaunchpadPage` | 发射台首页（本文档范围） |
| `/launchpad/create` | `CreateLaunchPage` | 创建代币表单（独立页面） |
| `/launchpad/:id` | `LaunchDetailPage` | 代币详情页（独立页面） |

---

## 2. 文件位置

```
packages/frontend/src/
├── pages/LaunchpadPage.tsx          # 主文件，所有组件均在此
├── i18n/zh-CN/launchpad.json        # 中文翻译
├── i18n/en/launchpad.json           # 英文翻译
├── lib/flap-portal.ts               # FLAP 合约 ABI + getPortalAddress()
├── lib/fourmeme-contracts.ts        # HELPER3_ADDRESS + Helper3_ABI
└── hooks/useFourMemeTokenInfo.ts    # mapFourMemeTokenInfo() 映射函数
```

---

## 3. 类型定义

```ts
interface TokenLaunch {
  id: string;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  tokenAddress?: string;
  txHash?: string;
  chainId: number;
  status: string;           // 'ACTIVE' | 'LISTED'
  taxRate: number;          // 单位 basis points，显示时 /100
  createdAt: string;        // ISO 8601
  launchPlatform?: string;  // 'FOURMEME' | 'FLAP'
  user: { id: string; username: string; avatarUrl?: string };
  skill?: { id: string; name: string; downloadCount?: number };
}

type OnChainData = { price: bigint; progress: number; marketCap?: number };
type PlatformFilter = 'ALL' | 'FOURMEME' | 'FLAP';
type ViewMode = 'kanban' | 'leaderboard';

interface ColFilter {
  keyword: string;
  minLiquidity: number;   // BNB，按 MCap 过滤
  minDownloads: number;   // skill.downloadCount 下限
  tags: ProgressTag[];    // 保留字段，当前 UI 未暴露
  open: boolean;          // 面板展开状态
}
```

---

## 4. 数据流

### 4.1 API 请求

```
GET /api/tokens?limit=60&page=1&sortBy=newest
```
- 请求由 `api`（Axios 实例）发出，代理转发至后端 `:3000`
- 成功：`data.tokens || data` → `setLaunches()`
- 失败：静默忽略，`launches` 保持为空 → 触发 Demo 模式

### 4.2 Demo 模式

```ts
const isDemo = !loading && launches.length === 0;
const effectiveLaunches = isDemo ? DEMO_LAUNCHES : launches;
const onChainMap = isDemo ? DEMO_ONCHAIN : liveOnChainMap;
```

`DEMO_LAUNCHES`：15 条硬编码代币，其中 13 条状态为 `ACTIVE`，2 条为 `LISTED`，覆盖两个平台，`createdAt` 使用真实 ISO 时间戳以保证排序正确。

`DEMO_ONCHAIN`：`Map<string, OnChainData>`，ACTIVE 代币价格区间约 5.1–6.3 BNB MCap，LISTED 代币 MCap 3120–4850 BNB。

### 4.3 链上数据读取（仅真实 launches 时）

**FLAP 协议**
```ts
wagmi.useReadContracts({
  contracts: flapLaunches.map(l => ({
    address: getPortalAddress(l.chainId),
    abi: PORTAL_ABI,
    functionName: 'getTokenV7',
    args: [l.tokenAddress as Hex],
    chainId: l.chainId,
  })),
  query: { enabled, refetchInterval: 30_000 }
})
```
结果字段：`result.price`（bigint），`result.progress`（bigint，18位精度）

**four.meme 协议**
```ts
wagmi.useReadContracts({
  contracts: fourMemeLaunches.map(l => ({
    address: HELPER3_ADDRESS,
    abi: Helper3_ABI,
    functionName: 'getTokenInfo',
    args: [l.tokenAddress as Hex],
    chainId: l.chainId,
  })),
  query: { enabled, refetchInterval: 15_000 }
})
```
结果经 `mapFourMemeTokenInfo()` 映射为 `{ lastPrice, progress, marketCap }`。

### 4.4 过滤排序 Pipeline（useMemo 链）

```
effectiveLaunches
  → platformFiltered   (按 launchPlatform 过滤，'ALL'/'FOURMEME'/'FLAP')
    → searchFiltered   (按 symbol 或 tokenAddress 模糊匹配 globalSearch)
      → newLaunches    (status !== 'LISTED', 按 createdAt 降序, .slice(0, 20))
      → listedLaunches (status === 'LISTED')
```

---

## 5. 组件树

```
LaunchpadPage
├── Header (title + subtitle + "发射代币" 按钮，需登录)
├── Toolbar (PlatformFilter pills + ViewMode toggle)
├── GlobalSearch (搜索框，过滤 symbol / tokenAddress)
├── [loading]  加载状态
├── [kanban]   两列 KanbanColumn
│   ├── KanbanColumn "新创建" (newLaunches)
│   │   ├── ColumnFilterPanel (流动性 + 下载数 筛选)
│   │   └── CompactCard × N
│   └── KanbanColumn "已发射" (listedLaunches)
│       ├── ColumnFilterPanel
│       └── CompactCard × N
├── [leaderboard] LeaderboardView
│   ├── 左列 LeaderboardRow rank 1–5
│   └── 右列 LeaderboardRow rank 6–10
├── HowItWorks (4步说明)
└── PoweredBy footer strip
```

---

## 6. 工具函数

| 函数 | 签名 | 说明 |
|---|---|---|
| `formatPrice` | `(price: bigint) → string` | 科学计数下标格式，如 `0.0₈51` |
| `formatMcap` | `(bnb: number) → string` | `5.1 BNB` / `1.2K BNB` |
| `getMcap` | `(data?) → number` | `marketCap ?? Number(formatEther(price)) × 1e9` |
| `getProgressTag` | `(progress?) → 'P1'/'P2'/'P3'/null` | P1 <33%，P2 <66%，P3 ≥66%（内部保留，UI 未暴露） |

---

## 7. CompactCard 字段布局（代码）

```
Row 1: [avatar 32px] [$SYMBOL  name  description…]
Row 2: [▲ price BNB] [MCap X.X BNB]
Row 3: [━━━━ 80px bar ━━━━] progress%
Row 4: [skill.name truncate  ↓ downloads] ··· [tax%] [platform badge]
```

- 无平台颜色左边框，统一使用 `border border-border/50`
- `PlatformBadge`：FOURMEME → amber 文字/背景；FLAP → purple 文字/背景
- 无图时 avatar 显示 `symbol[0]` 首字母占位，`bg-primary/15`
- 点击整张卡片跳转 `/launchpad/:id`（Demo 模式下禁用链接）

### PlatformBadge

```tsx
function PlatformBadge({ platform }: { platform?: string }) {
  return platform === 'FOURMEME'
    ? <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500/10 text-amber-500 font-medium">four.meme</span>
    : <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-purple-500/10 text-purple-400 font-medium">flap.sh</span>;
}
```

---

## 8. LeaderboardRow 字段布局

```
Row 1: [rank medal/# 28px] [avatar 36px] [$SYMBOL / name description…]
Row 2: [▲ price BNB] [MCap: X.X BNB]
Row 3: [━━━━ 96px bar ━━━━] progress.1%
Row 4: [skill.name  ↓ downloads] ··· [tax% badge] [platform badge] [已发射 badge]
```

排行榜按 MCap 降序，取 Top 10，左右各 5 条（`grid-cols-2`）。

---

## 9. ColumnFilterPanel

当前暴露两个过滤条件（`ColFilter.open` 控制面板展开）：

| 字段 | 控件 | 说明 |
|---|---|---|
| `minLiquidity` | number input | MCap ≥ N BNB |
| `minDownloads` | number input | skill.downloadCount ≥ N |

`tags`（P1/P2/P3 进度段）字段保留在 `ColFilter` 类型中但 UI 不再暴露。

---

## 10. 代币迁移至外盘的检测逻辑

「迁移到外盘」即 Bonding Curve 达到募集目标后，流动性自动注入 PancakeSwap，代币状态变为 `LISTED`。两个平台的检测字段不同。

### 10.1 FLAP 协议 — `statusCode === 4`

合约方法：`getTokenV7`（Portal 合约，`lib/flap-portal.ts`）

```ts
// hooks/useTokenInfo.ts
useReadContract({
  address: portalAddress,
  abi: PORTAL_ABI,
  functionName: 'getTokenV7',
  args: [tokenAddress],
  query: { refetchInterval: 15_000 },
})
```

返回结构中 `statusCode`（uint8）含义：

| statusCode | 含义 |
|---|---|
| 0 / 1 | Bonding Curve 阶段 |
| 2 / 3 | 迁移中（Migrating） |
| **4** | **已上 DEX（On DEX）= LISTED** |

详情页判断：
```tsx
// pages/TokenDetailPage.tsx
const isGraduated = tokenInfo?.statusCode === 4;
```

### 10.2 four.meme 协议 — `liquidityAdded === true`

合约方法：`getTokenInfo`（Helper3 合约，`lib/fourmeme-contracts.ts`）

```ts
// hooks/useFourMemeTokenInfo.ts
useReadContract({
  address: HELPER3_ADDRESS,
  abi: Helper3_ABI,
  functionName: 'getTokenInfo',
  args: [tokenAddress],
  query: { refetchInterval: 15_000 },
})
```

关键返回字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `liquidityAdded` | bool | `true` = 已注入 PancakeSwap 流动性，即毕业 |
| `funds` | uint256 | 当前 BNB 储备 |
| `maxFunds` | uint256 | 目标 BNB（达到后触发迁移） |
| `offers` | uint256 | 当前流通供应量 |
| `maxOffers` | uint256 | 供应上限 |

详情页判断：
```tsx
// pages/FourMemeTokenDetailPage.tsx
const isGraduated = tokenInfo?.liquidityAdded === true;
```

### 10.3 `status` 字段的来源

**发射台列表页**（`LaunchpadPage`）的 `TokenLaunch.status` 字段来自 API 服务端，不在前端实时计算。服务端通过轮询链上状态更新 `status`，前端直接消费结果：

```ts
// LaunchpadPage.tsx
const listedLaunches = searchFiltered.filter(l => l.status === 'LISTED');
```

**详情页**则通过 `useReadContract` 每 15 秒轮询链上状态，在客户端实时判断是否已毕业，两套机制并行运行，详情页感知更及时。

### 10.4 毕业后 UI 变化

- 发射台：代币从「新创建」列移至「已发射」列，卡片显示绿色「已发射」标签
- 详情页：隐藏买卖面板，展示「已上线外盘」横幅，附 PancakeSwap 和 DexScreener 跳转链接

---

## 11. 数据更新周期（列表层）

各视图的数据均来自同一次 API 请求（页面挂载时拉取一次，不自动轮询），分类展示如下：

| 视图 / 列 | 数据范围 | 排序依据 | 更新时机 |
|---|---|---|---|
| 新创建 | status ≠ LISTED | `createdAt` 降序，取前 20 | 每日北京时间 00:00 刷新（服务端写入新数据后页面重新加载生效） |
| 已发射 | status = LISTED | 不排序（保持 API 返回顺序） | 每日北京时间 00:00 同步 |
| 排行榜 | 全量 | MCap 降序，取前 10 | 每日北京时间 00:00 同步 |

> 链上价格（price / progress / MCap）由 `useReadContracts` 独立轮询，FLAP 每 30 秒、four.meme 每 15 秒，与代币列表更新周期无关。

---

## 12. 卡片点击与页面跳转

点击任意代币卡片（`CompactCard` / `LeaderboardRow`）跳转至对应详情页，路由为：

```
/launchpad/:id
```

实现方式：将 `inner` JSX 包裹在 `react-router-dom` 的 `<Link>` 中：

```tsx
if (isDemo) return inner;                          // Demo 模式禁用跳转
return <Link to={`/launchpad/${launch.id}`}>{inner}</Link>;
```

详情页（`LaunchDetailPage`）为已有页面，负责展示完整代币信息、买卖交互、评论、链上数据图表等。Demo 模式下卡片不可点击（`isDemo` 为 `true` 时直接返回裸 JSX，不包 `<Link>`）。

---

## 13. i18n 键（部分，`launchpad` 命名空间）

| 键 | 中文值 |
|---|---|
| `page.title` | 技能发射台 |
| `page.subtitle` | 通过 Flap 协议及 four.meme 协议在 BNB Chain 上发射技能代币… |
| `page.launchToken` | 发射代币 |
| `steps.submitSkill` | 提交技能 |
| `steps.createToken` | 创建代币 |
| `steps.deployOnChain` | 链上部署 |
| `steps.tradeEarn` | 交易赚取 |
