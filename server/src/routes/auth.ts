import { Router, type Request, type Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = Router();

// 测试用固定游客账号（仅供测试阶段跳过登录使用）
const GUEST_EMAIL = 'guest@kidx-test.local';
const GUEST_PASSWORD = 'guest123456';

/**
 * POST /api/v1/auth/guest
 * 测试阶段专用：游客一键登录（跳过手机验证码）
 * 返回真实的 Supabase session（access_token / refresh_token）
 * Body 参数：无
 */
router.post('/guest', async (_req: Request, res: Response) => {
  try {
    // 1. 用 service role 客户端确保游客账号存在
    const adminClient = getSupabaseClient();
    const { data: existing } = await adminClient.auth.admin.listUsers();
    const existingUser = existing?.users?.find((u: any) => u.email === GUEST_EMAIL);

    if (!existingUser) {
      const { error: createError } = await adminClient.auth.admin.createUser({
        email: GUEST_EMAIL,
        password: GUEST_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: '测试小朋友' },
      });
      if (createError && !String(createError.message).includes('already')) {
        console.error('Guest user create error:', createError);
        res.status(500).json({ error: 'Failed to create guest user' });
        return;
      }
    }

    // 2. 用匿名客户端以密码方式登录，拿到真实 session
    const anonClient = getSupabaseClient();
    const { data, error: signInError } = await anonClient.auth.signInWithPassword({
      email: GUEST_EMAIL,
      password: GUEST_PASSWORD,
    });
    if (signInError || !data.session) {
      console.error('Guest sign-in error:', signInError);
      res.status(500).json({ error: 'Guest sign-in failed' });
      return;
    }

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
    });
  } catch (error) {
    console.error('Guest login error:', error);
    res.status(500).json({ error: 'Guest login failed' });
  }
});

export default router;
