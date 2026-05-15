############################
# Stage 1: 安装依赖
############################
FROM node:20-alpine AS deps

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY packages/frontend/package*.json ./packages/frontend/
COPY packages/backend/package*.json ./packages/backend/

RUN npm ci


############################
# Stage 2: 构建前后端
############################
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

# 只复制必要源码，避免复制无关文件
COPY package*.json ./
COPY packages/frontend ./packages/frontend
COPY packages/backend ./packages/backend

# 安装 rollup musl 二进制文件
RUN npm install --no-save @rollup/rollup-linux-x64-musl

# 生成 Prisma Client
RUN npx prisma generate --schema=packages/backend/prisma/schema.prisma

# 前端和后端并行构建
RUN npm run build -w packages/frontend & \
    npm run build -w packages/backend & \
    wait

# 剪枝 devDependencies（在 builder 阶段做，产物更小，production 无需重复操作）
RUN npm prune --omit=dev


############################
# Stage 3: 生产环境
############################
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata openssl libressl libc6-compat

RUN addgroup -S nodejs -g 1001 \
    && adduser -S safuskill -u 1001 -G nodejs

ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=UTC

# 从 builder 复制已剪枝的 node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/backend/package*.json ./packages/backend/

# 复制构建产物
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/frontend/dist ./packages/frontend/dist

# 复制 Prisma schema
COPY --from=builder /app/packages/backend/prisma ./packages/backend/prisma

COPY packages/backend/.env ./.env

RUN mkdir -p storage/uploads storage/github-sync \
    && chown -R safuskill:nodejs /app

USER safuskill

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/users/me', r => process.exit([200,401].includes(r.statusCode)?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "packages/backend/dist/main"]
