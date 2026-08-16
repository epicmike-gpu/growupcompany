import { Router, type Request, type Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = Router();

/**
 * Middleware: verify auth token and attach user to request
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
 * GET /api/v1/profile
 * Get user profile (creates one if not exists)
 * Headers: x-session: string
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('user_profiles')
      .select('id, nickname, age, subscription_type, messages_remaining, created_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(`查询失败: ${error.message}`);

    if (data) {
      res.json(data);
    } else {
      // Create profile for new user
      const { data: newProfile, error: insertError } = await client
        .from('user_profiles')
        .insert({ user_id: userId })
        .select('id, nickname, age, subscription_type, messages_remaining, created_at')
        .single();

      if (insertError) throw new Error(`创建失败: ${insertError.message}`);
      res.json(newProfile);
    }
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/profile
 * Update user profile (nickname, age)
 * Headers: x-session: string
 * Body: { nickname?: string, age?: number }
 */
router.put('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { nickname, age } = req.body;
    const client = getSupabaseClient();

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (nickname !== undefined) updateData.nickname = nickname;
    if (age !== undefined) updateData.age = age;

    const { data, error } = await client
      .from('user_profiles')
      .update(updateData)
      .eq('user_id', userId)
      .select('id, nickname, age, subscription_type, messages_remaining')
      .single();

    if (error) throw new Error(`更新失败: ${error.message}`);
    res.json(data);
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/profile/upgrade
 * Upgrade subscription to premium (sets messages_remaining to -1 meaning unlimited)
 * Headers: x-session: string
 */
router.post('/upgrade', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('user_profiles')
      .update({
        subscription_type: 'premium',
        messages_remaining: -1,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select('id, subscription_type, messages_remaining')
      .single();

    if (error) throw new Error(`升级失败: ${error.message}`);
    res.json(data);
  } catch (error: any) {
    console.error('Upgrade error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
