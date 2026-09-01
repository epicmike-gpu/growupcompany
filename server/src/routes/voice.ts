import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for audio
});

/**
 * Middleware: verify auth token
 */
async function authMiddleware(req: Request, res: Response, next: Function) {
  const token = req.headers['x-session'] as string;
  if (!token) {
    res.status(401).json({ error: '请先登录' });
    return;
  }

  const client = getSupabaseClient(token);
  const { data: { user }, error: authError } = await client.auth.getUser();

  if (authError || !user) {
    res.status(401).json({ error: '认证失败' });
    return;
  }

  (req as any).userId = user.id;
  next();
}

// ---------------------------------------------------------------------------
// 火山引擎语音服务（openspeech.bytedance.com）
// 凭据来源：火山控制台「语音技术」创建应用后获取 AppID + Access Token
// ---------------------------------------------------------------------------

const VOLC_TTS_URL = 'https://openspeech.bytedance.com/api/v1/tts';
const VOLC_AUC_URL = 'https://openspeech.bytedance.com/api/v1/auc';

function getVolcCredentials() {
  const appId = process.env.VOLC_APP_ID;
  const accessToken = process.env.VOLC_ACCESS_TOKEN;
  if (!appId || !accessToken) {
    throw new Error('VOLC_APP_ID / VOLC_ACCESS_TOKEN is not configured');
  }
  return { appId, accessToken };
}

/**
 * POST /api/v1/voice/tts
 * Text-to-Speech: convert text to audio (火山语音合成, HTTP 非流式)
 * 服务端文件：server/src/routes/voice.ts
 * 接口：POST /api/v1/voice/tts
 * Headers: x-session: string
 * Body: { text: string, speaker?: string }
 * Returns: { success, audioUri, audioSize } — audioUri is a base64 data URI playable by expo-av
 */
// 语音凭据自检（脱敏）：GET /api/v1/voice/status
router.get('/status', (_req: Request, res: Response) => {
  const mask = (v?: string) => (v ? `${v.slice(0, 4)}***(len=${v.length})` : 'MISSING');
  res.json({
    volcAppId: mask(process.env.VOLC_APP_ID),
    volcAccessToken: mask(process.env.VOLC_ACCESS_TOKEN),
    ttsCluster: process.env.TTS_CLUSTER || 'volcano_tts(default)',
    ttsVoice: process.env.TTS_VOICE || 'BV001_streaming(default)',
    asrCluster: process.env.ASR_CLUSTER || 'volcano_auc(default)',
    llmBaseUrl: process.env.OPENAI_BASE_URL || 'ark-default',
    llmModel: process.env.LLM_MODEL || 'default',
    llmApiKey: process.env.OPENAI_API_KEY ? `set(len=${process.env.OPENAI_API_KEY.length})` : 'MISSING',
  });
});

router.post('/tts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      res.status(400).json({ error: '缺少文本参数' });
      return;
    }

    // 火山 HTTP 接口单次请求文本限制 1024 字节（UTF-8），超长截断
    let ttsText: string = text;
    while (Buffer.byteLength(ttsText, 'utf8') > 1000 && ttsText.length > 0) {
      ttsText = ttsText.slice(0, -20);
    }
    if (!ttsText.trim()) {
      res.status(400).json({ error: '文本过长' });
      return;
    }

    const { appId, accessToken } = getVolcCredentials();
    const cluster = process.env.TTS_CLUSTER || 'volcano_tts';
    const voiceType = process.env.TTS_VOICE || 'BV001_streaming'; // 通用女声（免费音色）

    const ttsRes = await fetch(VOLC_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 火山 TTS 的鉴权格式固定为 "Bearer;<token>"（分号）
        Authorization: `Bearer;${accessToken}`,
      },
      body: JSON.stringify({
        app: { appid: appId, token: accessToken, cluster },
        user: { uid: (req as any).userId || 'kidx-user' },
        audio: {
          voice_type: voiceType,
          encoding: 'mp3',
          rate: 24000,
          speed_ratio: 1.1, // 稍快语速，适合儿童注意力
        },
        request: {
          reqid: randomUUID(),
          text: ttsText,
          text_type: 'plain',
          operation: 'query',
        },
      }),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text().catch(() => '');
      throw new Error(`Volcano TTS HTTP ${ttsRes.status}: ${errText.slice(0, 200)}`);
    }

    const ttsJson: any = await ttsRes.json();
    if (ttsJson.code !== 3000 || !ttsJson.data) {
      throw new Error(`Volcano TTS error ${ttsJson.code}: ${ttsJson.message}`);
    }

    const audioBase64: string = ttsJson.data;
    const audioSize = Math.floor((audioBase64.length * 3) / 4);
    const audioUri = `data:audio/mpeg;base64,${audioBase64}`;

    res.json({
      success: true,
      audioUri,
      audioSize,
    });
  } catch (error: any) {
    console.error('TTS error:', error?.message || error);
    res.status(500).json({ error: error?.message || '语音合成失败' });
  }
});

/**
 * POST /api/v1/voice/asr
 * Speech Recognition: convert audio to text (火山录音文件识别极速版)
 *
 * 流程：m4a buffer → Supabase Storage（签名 URL）→ submit 任务 → 轮询 query → text
 * （前端录音为 m4a/mp4 容器，大模型 ASR 不支持，极速版 format:'mp4' 支持）
 *
 * 服务端文件：server/src/routes/voice.ts
 * 接口：POST /api/v1/voice/asr
 * Headers: x-session: string
 * Body: FormData with 'audio' file (m4a/mp4)
 */
router.post('/asr', authMiddleware, upload.single('audio'), async (req: Request, res: Response) => {
  const uploadedPath: string | null = `asr/${randomUUID()}.m4a`;
  try {
    if (!req.file) {
      res.status(400).json({ error: '请上传音频文件' });
      return;
    }

    const { buffer } = req.file;
    const { appId, accessToken } = getVolcCredentials();
    const cluster = process.env.ASR_CLUSTER;
    if (!cluster) {
      throw new Error('ASR_CLUSTER is not configured');
    }

    // 1. 上传音频到 Supabase Storage，生成短时效签名 URL 供火山下载
    const admin = getSupabaseClient(); // service role：绕过 RLS 上传音频
    if (!admin) {
      throw new Error('Supabase admin client unavailable (SERVICE_ROLE_KEY missing)');
    }

    const bucket = 'audio';
    const { error: bucketErr } = await admin.storage.createBucket(bucket, { public: false });
    if (bucketErr && !`${bucketErr.message}`.includes('exists')) {
      throw new Error(`createBucket failed: ${bucketErr.message}`);
    }

    const { error: upErr } = await admin.storage
      .from(bucket)
      .upload(uploadedPath, buffer, { contentType: 'audio/mp4', upsert: true });
    if (upErr) {
      throw new Error(`upload audio failed: ${upErr.message}`);
    }

    const { data: signed, error: signErr } = await admin.storage
      .from(bucket)
      .createSignedUrl(uploadedPath, 3600);
    if (signErr || !signed?.signedUrl) {
      throw new Error(`createSignedUrl failed: ${signErr?.message || 'no url'}`);
    }

    // 2. 提交识别任务（format mp4 = m4a 容器）
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer; ${accessToken}`,
    };
    const submitBody = {
      app: { appid: appId, token: accessToken, cluster },
      user: { uid: (req as any).userId || 'kidx-user' },
      audio: { format: 'mp4', url: signed.signedUrl },
      additions: { with_speaker_info: 'False' },
    };

    const submitRes = await fetch(`${VOLC_AUC_URL}/submit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(submitBody),
    });
    const submitJson: any = await submitRes.json();
    const taskId = submitJson?.resp?.id;
    if (submitJson?.resp?.code !== 1000 || !taskId) {
      throw new Error(`ASR submit failed: ${submitJson?.resp?.code} ${submitJson?.resp?.message}`);
    }

    // 3. 轮询结果（1.5s 间隔，最多 20 次 = 30s；儿童语音很短，通常 1-2 次即完成）
    let text = '';
    let duration: number | undefined;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const queryRes = await fetch(`${VOLC_AUC_URL}/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ appid: appId, token: accessToken, cluster, id: taskId }),
      });
      const queryJson: any = await queryRes.json();
      const resp = queryJson?.resp || {};
      const code = Number(resp.code);
      if (code === 1000) {
        text = resp.text || '';
        const firstUtter = Array.isArray(resp.utterances) ? resp.utterances[0] : null;
        const lastUtter = Array.isArray(resp.utterances)
          ? resp.utterances[resp.utterances.length - 1]
          : null;
        if (lastUtter?.end_time) {
          duration = Math.round(Number(lastUtter.end_time) / 1000);
        } else if (firstUtter) {
          duration = undefined;
        }
        break;
      }
      if (code >= 1000 && code < 2000) {
        throw new Error(`ASR task failed: ${code} ${resp.message}`);
      }
      // 2000 处理中 / 2001 排队中 → 继续等待
    }

    if (!text && !duration) {
      throw new Error('ASR query timeout');
    }

    res.json({
      success: true,
      text,
      ...(duration !== undefined ? { duration } : {}),
    });
  } catch (error: any) {
    console.error('ASR error:', error?.message || error);
    res.status(500).json({ error: error?.message || '语音识别失败' });
  } finally {
    // 4. 清理 Storage 临时音频（失败时尽力清理，不阻塞响应）
    if (uploadedPath) {
      try {
        const admin = getSupabaseClient(); // service role：绕过 RLS 上传音频
        if (admin) {
          await admin.storage.from('audio').remove([uploadedPath]);
        }
      } catch {
        /* cleanup best-effort */
      }
    }
  }
});

export default router;
