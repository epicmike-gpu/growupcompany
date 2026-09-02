import { Router, type Request, type Response } from 'express';
import { createHmac } from 'node:crypto';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = Router();

// 测试用固定游客账号（仅供未携带 deviceId 的旧版客户端兼容使用）
const LEGACY_GUEST_EMAIL = 'guest@kidx-test.local';
const LEGACY_GUEST_PASSWORD = 'guest123456';

// 设备专属游客账号的生成规则：email = guest-{deviceId}@kidx-test.local
// 密码由 deviceId + 私有盐派生（HMAC-SHA256），同设备稳定可复现，无需落库
const GUEST_PASSWORD_SECRET = 'kidx-guest-secret-v1';
const GUEST_EMAIL_DOMAIN = '@kidx-test.local';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function deriveGuestCredentials(deviceId: string): { email: string; password: string } {
  const password = createHmac('sha256', GUEST_PASSWORD_SECRET).update(deviceId).digest('hex').slice(0, 24);
  return { email: `guest-${deviceId}${GUEST_EMAIL_DOMAIN}`, password };
}

/**
 * POST /api/v1/auth/guest
 * 游客一键登录：按设备生成独立游客账号（每台设备独立 100 次额度与数据）
 * Body 参数：deviceId?: string（客户端持久化设备 UUID；缺省时回退旧版共享账号）
 * 返回：access_token: string, refresh_token: string, user: { id: string, email: string }
 */
router.post('/guest', async (req: Request, res: Response) => {
  try {
    // 1. 确定本次游客账号（deviceId 存在且合法 → 设备专属账号，否则旧版共享账号）
    const rawDeviceId = String(req.body?.deviceId || '').trim();
    let email = LEGACY_GUEST_EMAIL;
    let password = LEGACY_GUEST_PASSWORD;
    if (rawDeviceId && UUID_RE.test(rawDeviceId)) {
      ({ email, password } = deriveGuestCredentials(rawDeviceId));
    }

    // 2. 用 service role 客户端确保该游客账号存在（已存在时 Supabase 会返回 already 错误，直接忽略）
    const adminClient = getSupabaseClient();
    const { error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: '测试小朋友' },
    });
    if (createError && !String(createError.message).includes('already')) {
      console.error('Guest user create error:', createError);
      res.status(500).json({ error: 'Failed to create guest user' });
      return;
    }

    // 3. 用匿名客户端以密码方式登录，拿到真实 session
    const anonClient = getSupabaseClient();
    const { data, error: signInError } = await anonClient.auth.signInWithPassword({
      email,
      password,
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

/**
 * POST /api/v1/auth/merge-guest
 * 将游客/匿名账号的数据迁移到当前正式登录账号（Apple 登录等）
 * Header 参数：Authorization: Bearer <access_token>
 * Body 参数：oldUserId: string（游客账号的 user id）
 * 返回：{ merged: boolean, moved: Record<string, number> }
 */
router.post('/merge-guest', async (req: Request, res: Response) => {
  try {
    // 1. 鉴权：从 Bearer token 解析当前正式账号
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const userClient = getSupabaseClient(token);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const newUserId = userData.user.id;

    // 2. 参数校验
    const oldUserId = String(req.body?.oldUserId || '');
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(oldUserId)) {
      res.status(400).json({ error: 'oldUserId must be a valid uuid' });
      return;
    }
    if (oldUserId === newUserId) {
      res.json({ merged: false, reason: 'same-user' });
      return;
    }

    // 3. 安全校验：旧账号必须是游客（匿名账号或测试游客），防止越权吞并他人正式账号
    const adminClient = getSupabaseClient();
    const { data: oldUser } = await adminClient.auth.admin.getUserById(oldUserId);
    const oldEmail = String((oldUser?.user as any)?.email || '');
    const oldIsAnonymous = (oldUser?.user as any)?.is_anonymous === true;
    const isGuestAccount = oldUser?.user && (oldIsAnonymous || oldEmail.endsWith('@kidx-test.local'));
    if (!isGuestAccount) {
      res.status(400).json({ error: 'oldUserId is not a guest account' });
      return;
    }

    // 4. 数据迁移：聊天记录 + IAP 订单
    const moved: Record<string, number> = {};
    for (const table of ['chat_messages', 'iap_orders']) {
      const { data: updatedRows, error } = await adminClient
        .from(table)
        .update({ user_id: newUserId })
        .eq('user_id', oldUserId)
        .select('id');
      if (error) {
        console.error(`Merge ${table} error:`, error);
        res.status(500).json({ error: `Failed to merge ${table}` });
        return;
      }
      moved[table] = updatedRows?.length ?? 0;
    }

    // 5. user_profiles 迁移（有 UNIQUE 约束，冲突时保留新账号自己的 profile 并删除旧 profile）
    const { error: profileError } = await adminClient
      .from('user_profiles')
      .update({ user_id: newUserId })
      .eq('user_id', oldUserId);
    if (profileError) {
      if ((profileError as any).code === '23505') {
        await adminClient.from('user_profiles').delete().eq('user_id', oldUserId);
        moved['user_profiles'] = 0;
      } else {
        console.error('Merge user_profiles error:', profileError);
        res.status(500).json({ error: 'Failed to merge user_profiles' });
        return;
      }
    } else {
      moved['user_profiles'] = 1;
    }

    res.json({ merged: true, moved });
  } catch (error) {
    console.error('Merge guest error:', error);
    res.status(500).json({ error: 'Merge guest failed' });
  }
});

export default router;
