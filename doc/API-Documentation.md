# SafuSkill - AI Agent Skill Marketplace

## 项目概述

SafuSkill是一个AI Agent Skill市场平台，允许用户上传、分享和下载AI Agent Skill。平台集成了安全扫描功能，使用GoPlus AgentGuard对上传的技能进行安全检查。

## 前端功能

### 核心功能模块

**1. 用户认证系统**
- 钱包登录（支持MetaMask等Web3钱包，使用SIWE标准）
- 邮箱验证码登录（无密码登录）
- GitHub OAuth登录

**2. 技能市场**
- 浏览技能列表（分页展示）
- 查看技能详情
- 下载技能包
- 上传技能（需要登录）

**3. 用户管理**
- 用户个人资料
- 用户上传的技能管理
- 登录状态管理

**4. 安全功能**
- 技能安全扫描结果展示
- 风险级别标识（LOW/MEDIUM/HIGH/CRITICAL）

### 技术栈
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **路由**: React Router DOM
- **UI**: Tailwind CSS
- **状态管理**: Zustand
- **Web3集成**: Wagmi + Viem
- **HTTP客户端**: Axios

---

## 后端API接口文档

### 基础信息
- **基础URL**: `http://localhost:3000/api`
- **认证方式**: JWT Token (Bearer Token)
- **数据格式**: JSON

### 1. 认证接口 (`/api/auth`)

#### 1.1 发送邮箱验证码
```
POST /api/auth/send-code
```

**请求参数**:
```json
{
  "email": "user@example.com"
}
```

**响应**:
```json
{
  "success": true,
  "message": "Verification code sent successfully"
}
```

#### 1.2 验证邮箱验证码并登录
```
POST /api/auth/verify-code
```

**请求参数**:
```json
{
  "email": "user@example.com",
  "code": "123456",
  "username": "user123"
}
```

**响应**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "user123",
    "avatarUrl": null,
    "createdAt": "2026-03-09T10:00:00.000Z"
  }
}
```

#### 1.3 GitHub登录
```
GET /api/auth/github
```
重定向到GitHub OAuth页面进行授权。

#### 1.4 GitHub登录回调
```
GET /api/auth/github/callback
```
GitHub OAuth回调处理，成功后重定向到前端页面并携带token。

#### 1.5 获取钱包登录随机数
```
GET /api/auth/wallet/nonce?address=0x1234...
```

**查询参数**:
- `address`: 钱包地址

**响应**:
```json
{
  "nonce": "random_nonce_string"
}
```

#### 1.6 钱包签名登录
```
POST /api/auth/wallet/login
```

**请求参数**:
```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "message": "Sign in to SafuSkill...",
  "signature": "0x1234..."
}
```

**响应**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "username": "wallet_abc123",
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "avatarUrl": null,
    "createdAt": "2026-03-09T10:00:00.000Z"
  }
}
```

### 2. 用户接口 (`/api/users`)

#### 2.1 获取当前用户信息
```
GET /api/users/me
```

**认证**: 需要JWT Token

**响应**:
```json
{
  "id": "uuid",
  "username": "user123",
  "email": "user@example.com",
  "walletAddress": null,
  "githubId": null,
  "avatarUrl": null,
  "createdAt": "2026-03-09T10:00:00.000Z",
  "updatedAt": "2026-03-09T10:00:00.000Z"
}
```

### 3. 技能接口 (`/api/skills`)

#### 3.1 获取技能列表
```
GET /api/skills?page=1&limit=20
```

**查询参数**:
- `page`: 页码，默认1
- `limit`: 每页数量，默认20，最大100

**响应**:
```json
{
  "skills": [
    {
      "id": "uuid",
      "userId": "uuid",
      "name": "技能名称",
      "description": "技能描述",
      "filePath": "storage/uploads/filename.zip",
      "fileSize": 3981,
      "downloadCount": 10,
      "createdAt": "2026-03-09T10:00:00.000Z",
      "updatedAt": "2026-03-09T10:00:00.000Z",
      "user": {
        "id": "uuid",
        "username": "user123",
        "avatarUrl": null
      },
      "scanResult": {
        "status": "COMPLETED",
        "riskLevel": "LOW",
        "safeToUse": true
      }
    }
  ],
  "total": 2,
  "page": 1,
  "limit": 20,
  "hasMore": false
}
```

#### 3.2 获取技能详情
```
GET /api/skills/:id
```

**路径参数**:
- `id`: 技能UUID

**响应**:
```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "技能名称",
  "description": "技能描述",
  "filePath": "storage/uploads/filename.zip",
  "fileSize": 3981,
  "downloadCount": 10,
  "createdAt": "2026-03-09T10:00:00.000Z",
  "updatedAt": "2026-03-09T10:00:00.000Z",
  "user": {
    "id": "uuid",
    "username": "user123",
    "avatarUrl": null
  },
  "scanResult": {
    "status": "COMPLETED",
    "riskLevel": "LOW",
    "riskScore": 25,
    "safeToUse": true,
    "scanSummary": "Security scan completed - file appears safe",
    "scanDetails": {
      "risk_tags": [],
      "risk_level": "low",
      "scan_type": "agentguard"
    }
  }
}
```

#### 3.3 上传技能
```
POST /api/skills
```

**认证**: 需要JWT Token

**请求类型**: `multipart/form-data`

**请求参数**:
```
name: "技能名称" (必填，最大100字符)
description: "技能描述" (可选，最大1000字符)  
file: [文件] (必填，最大50MB，支持.zip格式)
```

**响应**:
```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "技能名称",
  "description": "技能描述",
  "filePath": "storage/uploads/filename.zip",
  "fileSize": 3981,
  "downloadCount": 0,
  "createdAt": "2026-03-09T10:00:00.000Z",
  "updatedAt": "2026-03-09T10:00:00.000Z"
}
```

#### 3.4 下载技能
```
GET /api/skills/:id/download
```

**路径参数**:
- `id`: 技能UUID

**响应**: 直接下载文件，文件名为技能名称+原扩展名

#### 3.5 删除技能
```
DELETE /api/skills/:id
```

**认证**: 需要JWT Token（只能删除自己的技能）

**路径参数**:
- `id`: 技能UUID

**响应**:
```json
{
  "success": true
}
```

### 4. 扫描接口 (`/api/scan`)

#### 4.1 获取技能扫描结果
```
GET /api/scan/:skillId
```

**路径参数**:
- `skillId`: 技能UUID

**响应**:
```json
{
  "skillId": "uuid",
  "status": "COMPLETED",
  "riskLevel": "LOW",
  "riskScore": 25,
  "safeToUse": true,
  "scanSummary": "Security scan completed - file appears safe",
  "scanDetails": {
    "risk_tags": [],
    "risk_level": "low",
    "scan_type": "agentguard"
  },
  "createdAt": "2026-03-09T10:00:00.000Z",
  "updatedAt": "2026-03-09T10:00:00.000Z"
}
```

**扫描状态说明**:
- `SCANNING`: 正在扫描
- `COMPLETED`: 扫描完成
- `FAILED`: 扫描失败

**风险级别说明**:
- `LOW`: 低风险（绿色）
- `MEDIUM`: 中等风险（黄色）
- `HIGH`: 高风险（橙色）
- `CRITICAL`: 严重风险（红色）

---

## 错误码说明

### HTTP状态码
- `200`: 成功
- `201`: 创建成功
- `400`: 请求参数错误
- `401`: 未认证或token无效
- `403`: 无权限访问
- `404`: 资源不存在
- `500`: 服务器内部错误

### 错误响应格式
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

---

## 安全功能

### AgentGuard集成
- 所有上传的技能包都会通过GoPlus AgentGuard进行安全扫描
- 扫描包括恶意代码检测、风险行为分析等
- 扫描结果实时显示在技能详情页面

### 认证安全
- JWT Token过期时间7天
- SIWE（Sign-In With Ethereum）标准钱包登录
- 邮箱验证码6位数字，5分钟有效期

### 文件安全
- 文件大小限制50MB
- 支持的文件格式：.zip
- 上传文件自动重命名为UUID防止冲突
- 文件存储在服务器本地目录

---

## 部署信息

### 环境配置
- **开发环境**: 
  - 前端: http://localhost:5173
  - 后端: http://localhost:3000
- **数据库**: MySQL
- **邮件服务**: Resend
- **文件存储**: 本地存储

### 环境变量
```env
# 数据库
DATABASE_URL="mysql://user:password@host:port/database"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# 邮件服务
RESEND_API_KEY="your-resend-api-key"
RESEND_FROM_EMAIL="SafuSkill <onboarding@resend.dev>"

# 文件上传
UPLOAD_DIR="./storage/uploads"
MAX_FILE_SIZE="52428800"
```