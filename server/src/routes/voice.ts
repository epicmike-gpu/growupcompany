import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { getSupabaseClient } from '../storage/database/supabase-client.js';
import OpenAI from 'openai';

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

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * POST /api/v1/voice/tts
 * Text-to-Speech: convert text to audio
 * Headers: x-session: string
 * Body: { text: string, speaker?: string }
 * Returns: { success, audioUri } — audioUri is a base64 data URI playable by expo-av
 */
router.post('/tts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      res.status(400).json({ error: '缺少文本参数' });
      return;
    }

    if (text.length > 4000) {
      res.status(400).json({ error: '文本过长' });
      return;
    }

    const openai = getOpenAIClient();
    const mp3 = await openai.audio.speech.create({
      model: process.env.TTS_MODEL || 'gpt-4o-mini-tts',
      voice: (process.env.TTS_VOICE as any) || 'nova', // Lively female voice, kid-friendly
      input: text,
      response_format: 'mp3',
      speed: 1.1, // Slightly faster for kids' attention
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const audioUri = `data:audio/mpeg;base64,${buffer.toString('base64')}`;

    res.json({
      success: true,
      audioUri,
      audioSize: buffer.length,
    });
  } catch (error: any) {
    console.error('TTS error:', error?.message || error);
    res.status(500).json({ error: error?.message || '语音合成失败' });
  }
});

/**
 * POST /api/v1/voice/asr
 * Speech Recognition: convert audio to text
 * Headers: x-session: string
 * Body: FormData with 'audio' file
 */
router.post('/asr', authMiddleware, upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: '请上传音频文件' });
      return;
    }

    const { buffer, mimetype } = req.file;
    const ext = (mimetype || 'audio/m4a').split('/')[1]?.split(';')[0] || 'm4a';

    const openai = getOpenAIClient();
    const result = await openai.audio.transcriptions.create({
      model: process.env.ASR_MODEL || 'whisper-1',
      file: new File([new Uint8Array(buffer)], `audio.${ext}`, { type: mimetype || 'audio/m4a' }),
    });

    res.json({
      success: true,
      text: result.text,
    });
  } catch (error: any) {
    console.error('ASR error:', error?.message || error);
    res.status(500).json({ error: error?.message || '语音识别失败' });
  }
});

export default router;
