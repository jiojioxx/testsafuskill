# SafuSkill Launchpad — 产品功能概述

## 一句话定义
Launchpad 是 SafuSkill 平台的 Token 发射台，允许任何用户为 AI Skill 创建绑定的 Bonding Curve Token，通过交易税费机制和使用量里程碑驱动 Skill 社区建设与生态增长。

---

## 核心概念

### Token 与 Skill 的关系
- 每个 Token **必须关联一个 Skill**（1对1绑定）
- 一个 Skill 只能被一个 Token 绑定
- Token 发行**需要 Skill 作者授权**：
  - **自己的 Skill**：直接发行（owner 或 verified author claim）
  - **别人的 Skill**：提交 Launch Request → 作者通过 GitHub 验证身份后 Approve/Reject
  - 请求者可获得一个**公开分享链接** (`/requests/:id`)，发给作者即可完成审批

### 发行权限流程
```
发币者选择 Skill
    ↓
是否是 Skill Owner / Verified Author？
    ├─ YES → 直接发行
    └─ NO → 提交 Launch Request（附可选消息）
                ↓
           生成公开链接 /requests/:id
                ↓
           请求者分享链接给 Skill 作者
                ↓
           作者打开链接 → GitHub OAuth 登录
                ↓
           系统验证 GitHub 账号 = Skill authorName
                ├─ 匹配 → 显示 Approve/Reject 按钮
                └─ 不匹配 → 拒绝操作
                ↓
           Approve → 自动创建 AuthorClaim + 请求状态变为 APPROVED
                ↓
           请求者可继续发行 Token
```

### Token 生命周期
```
创建草稿 → 链上部署 → Bonding Curve 交易 → 毕业迁移到 PancakeSwap DEX
 (DRAFT)   (DEPLOYING)     (ACTIVE)              (On DEX)
              ↓
           (FAILED)
```

---

## Flap 协议机制详解

### 1. Bonding Curve（联合曲线）

**核心公式**：`(x + h)(y + r) = K`（常数乘积公式）
- **x** = 代币储备（初始 10⁹ 个）
- **y** = 报价代币储备（BNB，初始 0）
- **h** = 虚拟代币储备
- **r** = 虚拟报价储备
- **K** = 虚拟流动性平方常数

**BSC 最新参数**：r=6.14, h=107036752, K=6797205657.28（参数不可变，每个 token 创建时固定）

**交易机制**：
- **买入**：用户发送 BNB → 合约铸造 Token 给用户（价格沿曲线上升）
- **卖出**：用户发送 Token → 合约销毁并返还 BNB（价格沿曲线下降）
- 最大供应量：10⁹（18位精度），用户最多能买 80%（8亿枚）

### 2. 毕业迁移到 DEX

**触发条件**（满足任一即可）：
- 流通量达到 8亿枚（总供应的 80%）
- 储备金达到阈值（当前 BSC：16 BNB 或 10,000 USD 等值）

**迁移过程**：
- 剩余未流通的 Token（约 2亿枚）+ 全部储备金 → 注入 PancakeSwap 流动性池
- Tax Token 只能迁移到 Uniswap V2 或其 fork（如 PancakeSwap V2）
- 非 Tax Token 可使用 V3 集中流动性（价格范围：初始价格 ~ 10,000x 最终价格）

### 3. 税费机制（核心社区建设工具）

**总体税率**：`taxRate`（0-10000 bps，即 0-100%）
- 每笔交易（买入/卖出）扣除 taxRate% 作为税费
- Bonding Curve 阶段：税费作为"额外费用"叠加在基础 1% 手续费上
  - 例：3% 税率 → 实际费用 = 1% + 3% = 4%
- DEX 阶段：Token 合约自动扣税

**税费分配（4个维度）**：

| 参数 | 名称 | 作用 | 社区价值 |
|------|------|------|----------|
| **mktBps** | 营销/基金 | 税收分配给指定钱包地址 | 资助 Skill 开发、社区运营、推广活动 |
| **deflationBps** | 通缩销毁 | 税收对应的 Token 永久销毁 | 减少供应量，长期持有者受益 |
| **dividendBps** | 持有者分红 | 税收按比例分配给所有持有者 | 激励持有、奖励社区贡献者 |
| **lpBps** | 流动性注入 | 税收自动加入 LP 池 | 增加交易深度，减少滑点 |

四个 bps 之和分配 100% 的税收。例：
- taxRate = 500（5% 总税率）
- mktBps=5000, deflationBps=2500, dividendBps=2000, lpBps=500
- 每笔交易的 5% 税收中：2.5% → 基金, 1.25% → 销毁, 1% → 分红, 0.25% → LP

**Tax Token 版本**：
- **V1**：所有税收发送到单一地址（100% mktBps 时自动创建）
- **V2**：税收分配到多个目标（需要至少 2 个维度 > 0）
  - 部署 TaxProcessor 合约（处理税收分配）
  - 若 dividendBps > 0，额外部署 Dividend 合约（管理分红）

**税收处理流程**：
```
交易产生税费
    ↓
TaxProcessor 累积（达到阈值自动清算）
    ↓
dispatch() 分发（任何人可调用，Flap Bot 自动触发）
    ↓
├─ mktBps → 指定钱包（基金/开发者）
├─ deflationBps → 销毁地址（永久减少供应）
├─ dividendBps → Dividend 合约 → 按比例分给持有者
└─ lpBps → 自动注入流动性池
```

**分红领取**：
- 持有者余额变动时自动触发 `setShare()`
- 手动：持有者调用 `withdrawDividends()`
- 自动：Bot 批量触发分发
- DEX 池、Token 合约、死地址等排除在外

**社区建设应用场景**：

| 场景 | 推荐配置 | 效果 |
|------|----------|------|
| 开发者主导 | mkt 80% + div 20% | 大部分资金用于开发，持有者获得分红激励 |
| 社区驱动 | div 50% + deflation 30% + lp 20% | 持有者高分红 + 通缩升值 + 流动性保障 |
| 纯增值型 | deflation 70% + lp 30% | 持续通缩 + 深度流动性 |
| 平衡型 | mkt 25% + div 25% + deflation 25% + lp 25% | 四维均衡 |

---

## 页面功能

### 1. Launchpad 首页 (`/launchpad`)
**目的**：展示所有活跃的 Token 发射项目

**内容**：
- 顶部：4步流程说明（Submit Skill → Create Token → Deploy On-Chain → Trade & Earn）
- Token 卡片网格：
  - Token 名称、符号、图片
  - 关联的 Skill 名称
  - 当前价格（链上实时读取）
  - Bonding Curve 进度条（0-100%）
  - 状态徽章（Deploying / Active / On DEX）
  - 税率标签（如 "5% Tax"）
- **排行榜/热门**（新增）：
  - 按交易量排名
  - 按 Skill 下载量排名
  - 按市值排名

### 2. 创建 Token 页 (`/launchpad/create`)
**目的**：引导用户为 Skill 创建 Token

**3步向导**：
1. **Token 信息**：名称、符号、描述、上传图片
2. **选择 Skill**：从平台 Skill 列表中选择一个未被绑定的 Skill
3. **经济模型配置 + 确认部署**：
   - 税率设置（taxRate）
   - 税费分配方案（mktBps / deflationBps / dividendBps / lpBps）
   - 提供预设方案模板（开发者主导 / 社区驱动 / 纯增值 / 自定义）
   - 营销钱包地址（mktBps 接收方）
   - 选择网络（BSC Testnet/Mainnet）
   - 预览并确认链上交易

**部署流程**：
- 上传元数据到 IPFS → 获取 CID
- 调用 Portal 合约 `newTokenV5()` 创建 Token
- 等待交易确认 → 提取 Token 地址
- 后端状态更新：DRAFT → DEPLOYING → ACTIVE

### 3. 发行请求页 (`/requests/:id`)
**目的**：公开可分享的 Launch Request 审批页面

**内容**：
- Request 状态徽章（Pending / Approved / Rejected / Used）
- Skill 信息卡片（名称、描述、作者、GitHub 仓库、stars、语言、分类）
- 请求者信息卡片（用户名、头像、钱包地址、附言、请求时间）
- **Author Verification 区域**：
  - 未登录 → "Sign in with GitHub to verify" 按钮
  - 已登录但 GitHub 账号不匹配 → 显示错误提示
  - 已登录且 GitHub 账号匹配 → Approve / Reject 按钮
- Approved 状态 → 显示 "Launch Token" 入口链接

**GitHub 验证流程**：
- 点击 GitHub 登录 → OAuth → 回调自动跳回当前页面
- 后端比对 `user.username` 与 `skill.authorName`
- 匹配则自动创建 AuthorClaim（VERIFIED）并 Approve 请求

### 4. Token 详情页 (`/launchpad/:id`)
**目的**：查看 Token 详情并进行买卖交易

**内容**：
- Token 基本信息 + 关联 Skill 信息
- 统计数据：当前价格、市值、储备、供应量、进度
- **税费信息展示**：税率 + 四维分配比例可视化
- **Bonding Curve 图表**：K线图 + 曲线叠加（1m/5m/15m/1h/4h 时间维度）
- **交易面板**：买入/卖出，支持报价预估（含税费提示）
- **Skill 使用量里程碑**（待定义，见下方）

---

## 待定义功能：里程碑解锁奖励

> **状态：功能定义中，暂不实施**

### 概念
基于关联 Skill 的下载/使用量设定里程碑，达到后解锁奖励，激励社区推广和使用 Skill。

### 初步设想
| 里程碑 | 条件 | 奖励示例 |
|--------|------|----------|
| Bronze | 100 次下载 | Token 空投给前 N 名持有者 |
| Silver | 500 次下载 | 解锁 Skill 高级功能 / 社区徽章 |
| Gold | 1,000 次下载 | 额外流动性注入 / 创建者奖金 |
| Diamond | 5,000 次下载 | Skill 首页推荐位 / 特殊 NFT |

具体奖励内容、阈值、实现方式待进一步讨论确定。

---

## 排行榜（新增）

### 排名维度
- **Hot**：24h 交易量最高
- **Top Gainers**：24h 价格涨幅最大
- **Most Used**：关联 Skill 下载量最高
- **Newest**：最新发射

### 展示方式
- Launchpad 首页顶部 Tab 切换排行视图
- 或作为侧边栏 widget

---

## 导航入口

- **Navbar**：新增 "Launchpad" 链接（在 Marketplace 和 Docs 之间）
- **Skill 详情页**：如果 Skill 已关联 Token，显示 "View Token" 按钮
- **Skill 详情页**：如果 Skill 未关联 Token，显示 "Launch Token" 按钮

---

## 技术架构

### 链
- BSC Mainnet (Chain ID: 56)
- BSC Testnet (Chain ID: 97)

### 合约
- **Flap Portal**：Token 创建、交易、毕业迁移
  - `newTokenV5()` — 创建 Token（含税费参数）
  - `swapExactInput()` — 买入/卖出交易
  - `getTokenV7()` — 查询 Token 状态（17+ 返回值）
  - `quoteExactInput()` — 报价预估（不改变状态）
- **TaxProcessor**（V2 自动部署）：税费累积与分发
- **Dividend**（dividendBps > 0 时部署）：持有者分红管理

### 后端 API
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /tokens | 创建 Token 草稿（需登录） |
| GET | /tokens | 列表（支持排序/筛选） |
| GET | /tokens/my | 我创建的 Token（需登录） |
| GET | /tokens/:id | Token 详情 |
| PUT | /tokens/:id/deploying | 标记部署中（需登录） |
| PUT | /tokens/:id/deployed | 标记已部署（需登录） |
| PUT | /tokens/:id/failed | 标记失败（需登录） |

### 数据模型 (TokenLaunch)
- id, userId, **skillId（必填）**, name, symbol, description, imageUrl
- metaCid, tokenAddress, txHash, chainId, status
- taxRate, mktBps, deflationBps, dividendBps, lpBps
- createdAt, updatedAt

---

## 实施进度

### Phase 1：核心功能 — ✅ 完成
- ✅ 前端路由和后端模块恢复
- ✅ skillId 改为必填
- ✅ Navbar 添加 Launchpad 入口
- ✅ Skill 详情页添加 Token 入口
- ✅ Flap Protocol 集成（Bonding Curve CDPV2）
- ✅ Token 创建页（3步向导 + 税费配置）
- ✅ 链上部署（`newTokenV5` / `newTokenV2`，vanity salt）
- ✅ IPFS 元数据上传（图片自动回写）

### Phase 2：Token 详情页 — ✅ 完成
- ✅ Token 基本信息 + 链上实时数据（`getTokenV7`）
- ✅ Bonding Curve 图表（`FlapTokenCirculatingSupplyChanged` 事件 + 分块查询）
- ✅ 买入/卖出交易面板（含税费预估）
- ✅ 税费分配可视化
- ✅ Linked Skill 卡片（作者、GitHub、stars、下载量、安装命令）
- ✅ 价格使用下标格式（`0.0₈5564`）替代科学计数法

### Phase 3：作者认领系统 — ✅ 完成
- ✅ AuthorClaim 数据模型（一个 Skill 只能被一人认领）
- ✅ GitHub OAuth 登录时存储 access token
- ✅ 通过 GitHub API 验证仓库写权限（`permissions.push`）
- ✅ `POST /author-claims` API（验证 + 创建认领）
- ✅ Beneficiary 钱包地址设置（`PUT /author-claims/:id/beneficiary`）
- ✅ Token 详情页 Verified Author 徽章
- ✅ Claim 按钮（未认领时显示）

### Phase 4：排行榜 — 🔧 部分完成
- ✅ Launchpad 首页排行 Tab（Newest / Most Used / Hot / Top Gainers）
- ✅ Newest、Most Used 排序（后端支持）
- 📋 Hot / Top Gainers 需要链上交易数据索引

### Phase 5：税收追踪与 Claim — 📋 待实施
- 📋 TaxProcessor 合约 ABI 集成（查询累积税收余额）
- 📋 链上 `dispatch()` 调用（触发税收分发）
- 📋 从交易事件估算累计税收金额
- 📋 链上 beneficiary 地址变更（需合约支持）

### Phase 6：里程碑系统 — 💡 待定义
- 功能定义确认后再实施

---

## 技术变更记录

### 2026-03-17
- Bonding Curve 图表数据源从 `TokenBought`/`TokenSold` 改为 `FlapTokenCirculatingSupplyChanged`（更可靠）
- PORTAL_ABI 事件参数名修正为官方文档命名（`ts`, `postPrice`, `eth`）
- 新增 `FlapTokenCirculatingSupplyChanged` 事件到 PORTAL_ABI
- Token 部署成功后自动从 IPFS 解析图片 URL 并回写后端

### 2026-03-18
- 新增 AuthorClaim 模块（数据模型 + API + 前端 UI）
- GitHub OAuth 策略改为存储 access token（用于后续仓库权限验证）
- Token 详情 API 返回 authorClaim 信息（通过 skill 关联）
- Token 发行费：0.005 BNB 发送到平台金库
- 评论系统：Comment 模型 + API + 前端 UI（频率限制 5条/分钟）
- 实时交易流：Token 详情页右侧 Recent Trades 面板
- 全局活动流：首页 marquee 滚动展示最新发射和评论
- Skill↔Token 双向导流：Skill 详情页 Token 价格横幅，市场卡片 $SYMBOL 标签
- Navbar 钱包地址显示优化（图标 + 缩写地址 + 点击复制）
