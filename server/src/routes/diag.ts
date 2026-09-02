import { Router } from "express";

const router = Router();

/**
 * 链路诊断：测试函数所在 region 到方舟北京（LLM/TTS/ASR 入口）的连通性。
 * 免鉴权，只做 TCP+TLS 握手级别的探测，不消耗 token。
 * GET /api/v1/diag/ark
 */
router.get('/ark', async (_req, res) => {
  const host = 'https://ark.cn-beijing.volces.com';
  const started = Date.now();
  try {
    // 用 HEAD 请求打一个不存在的路径：只要能完成 DNS+TCP+TLS 并收到任何 HTTP 状态码，
    // 就证明链路通（404/405 也算通）；只有超时/连接拒绝才算不通。
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(`${host}/diag-probe`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timer);
    const elapsed = Date.now() - started;
    // 方舟对不存在路径返回 40x —— 收到即链路 OK
    res.json({
      ok: true,
      host,
      httpStatus: r.status,
      elapsedMs: elapsed,
      verdict: elapsed < 3000 ? '链路通畅' : '链路通但慢',
    });
  } catch (err: any) {
    const elapsed = Date.now() - started;
    res.json({
      ok: false,
      host,
      elapsedMs: elapsed,
      errorName: err?.name || 'Unknown',
      verdict: elapsed >= 8000 ? '连接超时——该 region 到方舟北京不通' : '连接失败——DNS/网络层不通',
    });
  }
});

export default router;
