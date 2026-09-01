/**
 * Vercel Serverless 入口（单项目架构）
 * 仓库根 /api/index.ts 包装 Express app（server/src/app.ts）
 * 路由：/api/v1/* 由根 vercel.json rewrites 指向本函数
 */
import app from '../server/src/app';

export default app;
