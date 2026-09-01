#!/bin/bash
# Vercel 单项目构建脚本：
# 1. 安装 workspace 依赖（由 Vercel installCommand 自动完成 pnpm install）
# 2. Expo Web 导出静态文件到 client/dist（由 vercel.json outputDirectory 托管）
# 3. API 无需构建 —— api/index.ts 由 Vercel (@vercel/node) 直接编译为 Serverless Function
set -euo pipefail

echo "[vercel-build] exporting Expo Web (client/dist)..."
cd client
npx expo export --platform web
cd ..

echo "[vercel-build] done."
