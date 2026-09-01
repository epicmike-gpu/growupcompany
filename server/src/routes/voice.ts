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

const VOLC_TTS2_URL = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';
const VOLC_TTS2_RESOURCE = 'seed-tts-2.0'; // 豆包语音合成大模型 2.0
const VOLC_ASR2_URL = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel';
const VOLC_ASR2_RESOURCE = 'volc.seedasr.auc'; // 豆包录音文件识别大模型 2.0

/**
 * TTS 2.0 鉴权双轨：
 * - 新版控制台：单 API Key（X-Api-Key）→ VOLC_API_KEY
 * - 旧版应用：AppID + Access Token → VOLC_APP_ID / VOLC_ACCESS_TOKEN
 */
function getTts2Auth(): Record<string, string> {
  const apiKey = process.env.VOLC_API_KEY;
  if (apiKey) {
    return { 'X-Api-Key': apiKey };
  }
  const appId = process.env.VOLC_APP_ID;
  const accessToken = process.env.VOLC_ACCESS_TOKEN;
  if (appId && accessToken) {
    return { 'X-Api-App-Id': appId, 'X-Api-Access-Key': accessToken };
  }
  throw new Error('TTS 凭据未配置：请在 Vercel 设置 VOLC_API_KEY（新版单Key）或 VOLC_APP_ID + VOLC_ACCESS_TOKEN（旧版）');
}

/**
 * ASR 2.0 鉴权双轨（豆包录音文件识别大模型 2.0）：
 * - 新版控制台：单 API Key（X-Api-Key）→ VOLC_API_KEY
 * - 旧版应用：AppID + Access Token → VOLC_APP_ID / VOLC_ACCESS_TOKEN
 *   （注意：ASR 旧版 Header 名为 X-Api-App-Key，与 TTS 旧版的 X-Api-App-Id 不同）
 */
function getAsrAuth(): Record<string, string> {
  const apiKey = process.env.VOLC_API_KEY;
  if (apiKey) {
    return { 'X-Api-Key': apiKey };
  }
  const appId = process.env.VOLC_APP_ID;
  const accessToken = process.env.VOLC_ACCESS_TOKEN;
  if (appId && accessToken) {
    return { 'X-Api-App-Key': appId, 'X-Api-Access-Key': accessToken };
  }
  throw new Error('ASR 凭据未配置：请在 Vercel 设置 VOLC_API_KEY（新版单Key）或 VOLC_APP_ID + VOLC_ACCESS_TOKEN（旧版）');
}

/**
 * 按上传 mimetype 映射大模型录音识别的 format：
 * 支持 raw / wav / mp3 / ogg / pcm / spx / amr / aac / m4a
 * （Expo Go / iOS Safari 录音为 audio/mp4|m4a；Android Chrome 可能为 audio/webm）
 */
function mapAudioFormat(mime?: string): { format: string; codec?: string } {
  const m = (mime || '').toLowerCase();
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return { format: 'm4a' };
  if (m.includes('wav')) return { format: 'wav' };
  if (m.includes('mpeg') || m.includes('mp3')) return { format: 'mp3' };
  // webm/ogg 容器内通常为 opus 编码，按 ogg(opus) 提交
  if (m.includes('webm') || m.includes('ogg') || m.includes('opus')) return { format: 'ogg', codec: 'opus' };
  return { format: 'm4a' }; // 前端 createFormDataFile 固定 audio/m4a
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
    ttsAuthMode: process.env.VOLC_API_KEY ? 'api-key(新版)' : (process.env.VOLC_APP_ID && process.env.VOLC_ACCESS_TOKEN ? 'appid+token(旧版)' : 'MISSING'),
    volcApiKey: mask(process.env.VOLC_API_KEY),
    volcAppId: mask(process.env.VOLC_APP_ID),
    volcAccessToken: mask(process.env.VOLC_ACCESS_TOKEN),
    ttsVoice: process.env.TTS_VOICE || 'MISSING(必填：2.0音色库音色ID)',
    asrAuthMode: process.env.VOLC_API_KEY ? 'api-key(新版)' : (process.env.VOLC_APP_ID && process.env.VOLC_ACCESS_TOKEN ? 'appid+token(旧版)' : 'MISSING'),
    asrResource: 'volc.seedasr.auc(豆包录音识别2.0)',
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

    const ttsAuthHeaders = getTts2Auth();
    const speaker = process.env.TTS_VOICE; // 豆包 2.0 音色 ID（控制台音色库复制，如 zh_female_xxx）
    if (!speaker) {
      throw new Error('TTS_VOICE is not configured — 请在火山控制台「豆包语音合成模型 2.0」音色库复制音色 ID');
    }

    // 豆包语音合成大模型 2.0（HTTP Chunked，逐帧 JSON：{code, data(base64)}）
    const ttsRes = await fetch(VOLC_TTS2_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...ttsAuthHeaders,
        'X-Api-Resource-Id': VOLC_TTS2_RESOURCE,
        'X-Api-Request-Id': randomUUID(),
      },
      body: JSON.stringify({
        req_params: {
          text: ttsText,
          speaker,
          audio_params: {
            format: 'mp3',
            sample_rate: 24000,
            speech_rate: 10, // 略快语速（-50 ~ 100），适合儿童注意力
          },
        },
      }),
    });

    if (!ttsRes.ok || !ttsRes.body) {
      const errText = await ttsRes.text().catch(() => '');
      throw new Error(`Volcano TTS2 HTTP ${ttsRes.status}: ${errText.slice(0, 200)}`);
    }

    // 解析 chunked 流：每行一个 JSON 帧，code=0 时 data 为 base64 音频
    const decoder = new TextDecoder();
    let frameBuf = '';
    let audioBase64 = '';
    for await (const chunk of ttsRes.body as any) {
      frameBuf += decoder.decode(chunk as any, { stream: true });
      const lines = frameBuf.split('\n');
      frameBuf = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let frame: any;
        try {
          frame = JSON.parse(trimmed);
        } catch {
          continue;
        }
        if (frame.code === 0 && frame.data) {
          audioBase64 += frame.data;
        } else if (frame.done) {
          break;
        } else if (typeof frame.code === 'number' && frame.code !== 0 && frame.code !== 20000000) {
          throw new Error(`Volcano TTS2 frame error ${frame.code}: ${frame.message ?? ''}`);
        }
      }
    }

    if (!audioBase64) {
      throw new Error('Volcano TTS2 returned no audio data');
    }

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
 * Speech Recognition: convert audio to text (豆包录音文件识别大模型 2.0, volc.seedasr.auc)
 *
 * 流程：m4a buffer → Supabase Storage（签名 URL）→ submit 任务(task_id=X-Api-Request-Id)
 *       → 轮询 query(body 为空 {}，同一个 X-Api-Request-Id) → result.text
 * 大模型 2.0 原生支持 m4a（无需再标 mp4 容器）
 *
 * 服务端文件：server/src/routes/voice.ts
 * 接口：POST /api/v1/voice/asr
 * Headers: x-session: string
 * Body: FormData with 'audio' file (m4a/mp4/webm/ogg)
 */
router.post('/asr', authMiddleware, upload.single('audio'), async (req: Request, res: Response) => {
  const uploadedPath: string | null = `asr/${randomUUID()}.m4a`;
  try {
    if (!req.file) {
      res.status(400).json({ error: '请上传音频文件' });
      return;
    }

    const { buffer, mimetype } = req.file;
    const asrAuth = getAsrAuth();
    const { format, codec } = mapAudioFormat(mimetype);

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
      .upload(uploadedPath, buffer, { contentType: mimetype || 'audio/mp4', upsert: true });
    if (upErr) {
      throw new Error(`upload audio failed: ${upErr.message}`);
    }

    const { data: signed, error: signErr } = await admin.storage
      .from(bucket)
      .createSignedUrl(uploadedPath, 3600);
    if (signErr || !signed?.signedUrl) {
      throw new Error(`createSignedUrl failed: ${signErr?.message || 'no url'}`);
    }

    // 2. 提交识别任务：X-Api-Request-Id 即 task_id，提交与查询共用
    const taskId = randomUUID();
    const headers = {
      'Content-Type': 'application/json',
      ...asrAuth,
      'X-Api-Resource-Id': VOLC_ASR2_RESOURCE,
      'X-Api-Request-Id': taskId,
      'X-Api-Sequence': '-1',
    };
    const submitBody = {
      user: { uid: ((req as any).userId as string) || 'kidx-user' },
      audio: { url: signed.signedUrl, format, ...(codec ? { codec } : {}) },
      request: {
        model_name: 'bigmodel',
        enable_itn: true, // 数字/日期规范格式化，利于儿童阅读
        enable_punc: true,
        show_utterances: true, // 返回分句时间，用于计算 duration
      },
    };

    const submitRes = await fetch(`${VOLC_ASR2_URL}/submit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(submitBody),
    });
    const submitStatus = submitRes.headers.get('X-Api-Status-Code') || '';
    if (!submitRes.ok || submitStatus !== '20000000') {
      const errText = await submitRes.text().catch(() => '');
      throw new Error(`ASR submit failed: HTTP ${submitRes.status} code=${submitStatus} ${errText.slice(0, 200)}`);
    }

    // 3. 轮询结果（1.5s 间隔，最多 20 次 = 30s；儿童语音很短，通常 1-2 次即完成）
    // 20000000=成功；其余 code 视为处理中/未知，继续轮询直至超时
    let text = '';
    let duration: number | undefined;
    let lastCode = '';
    let lastMsg = '';
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const queryRes = await fetch(`${VOLC_ASR2_URL}/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      lastCode = queryRes.headers.get('X-Api-Status-Code') || '';
      lastMsg = queryRes.headers.get('X-Api-Message') || '';
      if (lastCode === '20000000') {
        const queryJson: any = await queryRes.json().catch(() => null);
        const result = queryJson?.result;
        if (typeof result?.text === 'string') {
          text = result.text;
        } else if (Array.isArray(result)) {
          text = result.map((r: any) => r?.text || '').join('');
        }
        const utterances = result?.utterances;
        if (Array.isArray(utterances) && utterances.length > 0) {
          const last = utterances[utterances.length - 1];
          if (last?.end_time) {
            duration = Math.round(Number(last.end_time) / 1000);
          }
        }
        break;
      }
    }

    if (!text) {
      throw new Error(`ASR query timeout or failed: code=${lastCode || 'unknown'} msg=${lastMsg || 'no message'}`);
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
