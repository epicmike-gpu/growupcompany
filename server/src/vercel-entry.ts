// Vercel Serverless 入口源文件。
// 构建时由 vercel-build.sh 用 esbuild 打包为自包含 CJS（api/index.js），
// 运行时 Vercel 直接加载产物，避免 ESM/CJS 互操作问题。
import app from './app';

export default app;
