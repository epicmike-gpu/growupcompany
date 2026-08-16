import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { getSupabaseClient } from '../storage/database/supabase-client.js';
import { TTSClient, ASRClient, LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import axios from 'axios';
import path from 'path';
import fs from 'fs';

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

/**
 * POST /api/v1/voice/tts
 * Text-to-Speech: convert text to audio
 * Headers: x-session: string
 * Body: { text: string, speaker?: string }
 */
router.post('/tts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { text, speaker } = req.body;

    if (!text) {
      res.status(400).json({ error: '缺少文本参数' });
      return;
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const config = new Config();
    const ttsClient = new TTSClient(config, customHeaders);

    const response = await ttsClient.synthesize({
      uid: (req as any).userId,
      text,
      speaker: speaker || 'zh_female_xueayi_saturn_bigtts', // Children's audiobook voice
      audioFormat: 'mp3',
      sampleRate: 24000,
      speechRate: 10, // Slightly faster for kids' attention
    });

    // Download audio and save to /tmp
    const audioData = await axios.get(response.audioUri, { responseType: 'arraybuffer' });
    const fileName = `tts_${Date.now()}.mp3`;
    const filePath = path.join('/tmp', fileName);
    fs.writeFileSync(filePath, Buffer.from(audioData.data));

    res.json({
      success: true,
      audioUri: response.audioUri,
      audioSize: response.audioSize,
      localPath: filePath,
    });
  } catch (error: any) {
    console.error('TTS error:', error);
    res.status(500).json({ error: error.message || '语音合成失败' });
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
    const base64Audio = buffer.toString('base64');

    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const config = new Config();
    const asrClient = new ASRClient(config, customHeaders);

    const result = await asrClient.recognize({
      uid: (req as any).userId,
      base64Data: base64Audio,
    });

    res.json({
      success: true,
      text: result.text,
      duration: result.duration,
    });
  } catch (error: any) {
    console.error('ASR error:', error);
    res.status(500).json({ error: error.message || '语音识别失败' });
  }
});

export default router;
