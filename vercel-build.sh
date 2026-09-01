#!/bin/bash
# Vercel 单项目构建脚本：
# 1. Expo Web 导出静态文件到 client/dist（由 vercel.json outputDirectory 托管）
# 2. API 预打包为自包含 CJS（api/index.js）——避免 Vercel 对 ESM 源码做单文件转译
#    导致的 ERR_REQUIRE_ESM（server 是 ESM，被 CJS require 会崩）
set -euo pipefail

echo "[vercel-build] exporting Expo Web (client/dist)..."
cd client
npx expo export --platform web
cd ..

echo "[vercel-build] bundling API (api/index.js)..."
cd server
npx esbuild src/vercel-entry.ts \
  --bundle \
  --platform=node \
  --format=cjs \
  --target=node20 \
  --outfile=../api/index.js \
  --log-level=warning
cd ..

echo "[vercel-build] done."
