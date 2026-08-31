import { Router, type Request, type Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client.js';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const router = Router();

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

// System prompts for different command types
const COMMAND_PROMPTS: Record<string, string> = {
  drink_water: '你是一个温柔可爱的小朋友陪伴精灵。现在要用小朋友能听懂的、有趣的语言，鼓励小朋友去喝水。用简短、活泼、有想象力的方式说话，可以用水果、小动物等比喻。回复控制在2-4句话内。',
  sleep: '你是一个温柔可爱的小朋友陪伴精灵。现在要用小朋友能听懂的、温柔的语言，哄小朋友去睡觉。可以讲一个很短的睡前小故事或者用美好的想象引导入睡。回复控制在3-5句话内。',
  rest: '你是一个温柔可爱的小朋友陪伴精灵。现在要用小朋友能听懂的、轻松的语气，引导小朋友休息一下。可以建议一些放松的小活动，比如看看窗外、伸展一下。回复控制在2-4句话内。',
  bath: '你是一个温柔可爱的小朋友陪伴精灵。现在要用小朋友能听懂的、开心的语言，鼓励小朋友去洗澡。可以把洗澡变得很有趣，比如想象自己是小鸭子、泡泡王国等。回复控制在2-4句话内。',
  eat_vegetables: '你是一个温柔可爱的小朋友陪伴精灵。现在要用小朋友能听懂的、有趣的语言，鼓励小朋友多吃蔬菜。可以用超级英雄、魔法力量等比喻让蔬菜变得很酷。回复控制在2-4句话内。',
  brush_teeth: '你是一个温柔可爱的小朋友陪伴精灵。现在要用小朋友能听懂的、活泼的语言，引导小朋友去刷牙。可以把刷牙变成有趣的游戏或者冒险。回复控制在2-4句话内。',
  exercise: '你是一个温柔可爱的小朋友陪伴精灵。现在要用小朋友能听懂的、充满活力的语言，鼓励小朋友做运动。可以想象自己是小动物或者超级英雄在运动。回复控制在2-4句话内。',
  study: '你是一个温柔可爱的小朋友陪伴精灵。现在要用小朋友能听懂的、鼓励的语气，引导小朋友去学习。可以让学习变得像冒险一样有趣。回复控制在2-4句话内。',
  free_chat: '你是一个温柔可爱的小朋友陪伴精灵，正在和一个小朋友聊天。用小朋友能听懂的、温暖有趣的语言回应。回复要简短有趣，控制在2-4句话内。',
};

/**
 * GET /api/v1/messages
 * Get chat history for the user
 * Headers: x-session: string
 * Query: command_type?: string, limit?: number
 */
router.get('/messages', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { command_type, limit = '20' } = req.query;
    const client = getSupabaseClient();

    let query = client
      .from('chat_messages')
      .select('id, role, content, command_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(parseInt(limit as string), 50));

    if (command_type) {
      query = query.eq('command_type', command_type as string);
    }

    const { data, error } = await query;
    if (error) throw new Error(`查询失败: ${error.message}`);
    res.json(data || []);
  } catch (error: any) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/chat
 * SSE streaming chat endpoint
 * Headers: x-session: string
 * Body: { message: string, command_type: string, age: number }
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { message, command_type, age, history } = req.body;
    // 兼容 camelCase 和 snake_case 两种命名
    const englishTutor = req.body.englishTutor === true || req.body.english_tutor === true;

    if (!message || !command_type) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }

    const supabaseClient = getSupabaseClient();

    // Check quota
    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('messages_remaining, subscription_type, age')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) throw new Error(`查询资料失败: ${profileError.message}`);

    const userAge = age || profile?.age || 5;
    const isPremium = profile?.subscription_type === 'premium';
    const remaining = profile?.messages_remaining ?? 20;

    if (!isPremium && remaining <= 0) {
      res.status(403).json({ error: '今日对话额度已用完，请升级会员获取更多对话次数' });
      return;
    }

    // Save user message
    await supabaseClient.from('chat_messages').insert({
      user_id: userId,
      role: 'user',
      content: message,
      command_type,
    });

    // Build system prompt based on age and command type
    const basePrompt = COMMAND_PROMPTS[command_type] || COMMAND_PROMPTS['free_chat'];
    const agePrompt = `小朋友的年龄是${userAge}岁，请根据这个年龄调整语言的复杂程度，确保${userAge}岁的小朋友能完全理解。`;
    let systemPrompt = `${basePrompt}\n\n${agePrompt}`;

    // English Tutor mode: reply in Chinese first, then repeat in simple English
    const englishTutorEnabled = englishTutor === true;
    if (englishTutorEnabled) {
      systemPrompt += `\n\n【English Tutor 模式】你的回复必须严格按照以下格式输出：
1. 先用中文回复（2-4句话，符合小朋友年龄的活泼语言）。中文部分必须有内容，绝对不能为空。
2. 然后单独输出一行分隔符：---EN---
3. 分隔符之后，用非常简单的英语再说一遍同样的意思（2-4句话，使用${userAge <= 5 ? '最基础' : '简单'}的英语单词和短句，适合${userAge}岁小朋友听懂）。
注意：
- 分隔符 ---EN--- 必须单独成行，不要在分隔符前后加其他文字。
- 必须先完整输出中文部分，再输出分隔符和英语部分，顺序绝对不能颠倒。`;
    }

    systemPrompt += `\n\n【回复重点】请优先回应小朋友刚刚说的最新内容；如果小朋友说的是其他语言或不太清楚，请围绕他说的话友好互动，不要重复之前的话题。如果完全听不懂，请温和地请小朋友再说一遍。`;

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, no-transform, must-revalidate');
    res.setHeader('Connection', 'keep-alive');

    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const config = new Config();
    const llmClient = new LLMClient(config, customHeaders);

    const llmMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add history if provided (older messages first, newest last)
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          llmMessages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Current message MUST be the last one, so the LLM prioritizes it
    llmMessages.push({ role: 'user', content: message });

    const stream = llmClient.stream(llmMessages, {
      model: 'doubao-seed-2-0-mini-260215',
      temperature: 0.9,
    });

    let fullResponse = '';
    let currentLang: 'zh' | 'en' = 'zh';
    let pendingBuffer = '';

    // Parse the ---EN--- separator and emit language-tagged chunks
    const emitChunk = (text: string, lang: 'zh' | 'en') => {
      if (text) {
        res.write(`data: ${JSON.stringify({ content: text, lang })}\n\n`);
      }
    };

    for await (const chunk of stream) {
      if (chunk.content) {
        const text = chunk.content.toString();
        fullResponse += text;

        if (!englishTutorEnabled) {
          emitChunk(text, 'zh');
          continue;
        }

        pendingBuffer += text;
        while (true) {
          const idx = pendingBuffer.indexOf('---EN---');
          if (idx === -1) {
            // No full separator yet; flush safe portion (keep last 8 chars in case separator is split across chunks)
            if (pendingBuffer.length > 8) {
              const safeText = pendingBuffer.slice(0, pendingBuffer.length - 8);
              pendingBuffer = pendingBuffer.slice(pendingBuffer.length - 8);
              emitChunk(safeText, currentLang);
            }
            break;
          }
          // Emit text before the separator, then switch language
          emitChunk(pendingBuffer.slice(0, idx), currentLang);
          currentLang = 'en';
          pendingBuffer = pendingBuffer.slice(idx + 8);
        }
      }
    }

    // Flush remaining buffer
    if (englishTutorEnabled && pendingBuffer) {
      emitChunk(pendingBuffer, currentLang);
    }

    // Save assistant message (strip separator for storage)
    const storedContent = fullResponse.replace(/---EN---/g, '\n\n');
    await supabaseClient.from('chat_messages').insert({
      user_id: userId,
      role: 'assistant',
      content: storedContent,
      command_type,
    });

    // Decrement quota for free users
    if (!isPremium) {
      await supabaseClient
        .from('user_profiles')
        .update({
          messages_remaining: Math.max(0, remaining - 1),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

export default router;
