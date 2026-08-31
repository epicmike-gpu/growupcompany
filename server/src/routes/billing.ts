import { Router, type Request, type Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = Router();

// ==================== 商品配置 ====================
// 上架 App Store 时：在 App Store Connect 创建相同 product_id 的消耗型内购商品即可
interface IapProduct {
  product_id: string;
  title: string;
  subtitle: string;
  credits: number;
  price_cents: number;
  currency: string;
  tag?: string;
  badge?: string;
}

const IAP_PRODUCTS: IapProduct[] = [
  {
    product_id: 'com.kidx.credits.100',
    title: '100 次对话',
    subtitle: '适合体验完整的精灵陪伴',
    credits: 100,
    price_cents: 1990,
    currency: 'CNY',
    tag: '¥19.9',
    badge: '超值',
  },
];

// ==================== 鉴权中间件 ====================
async function authMiddleware(req: Request, res: Response, next: Function) {
  const token = req.headers['x-session'] as string;
  if (!token) {
    res.status(401).json({ error: '请先登录' });
    return;
  }
  const client = getSupabaseClient(token);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) {
    res.status(401).json({ error: '认证失败' });
    return;
  }
  (req as any).userId = user.id;
  next();
}

/**
 * 服务端文件：server/src/routes/billing.ts
 * 接口：GET /api/v1/billing/products
 * Query 参数：无
 * 返回：充值商品列表（次数包）
 */
router.get('/products', (_req: Request, res: Response) => {
  res.json({ products: IAP_PRODUCTS });
});

/**
 * 服务端文件：server/src/routes/billing.ts
 * 接口：POST /api/v1/billing/orders
 * Headers: x-session: string
 * Body 参数：product_id: string
 * 返回：创建的订单（status=pending）
 *
 * [IAP 接入点] 真实上架时：客户端先向 Apple 购买，拿到 transaction/receipt 后
 * 将 transaction_id 一起传入本接口（或传入 verify），由服务端向 Apple 验证收据后发货。
 */
router.post('/orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const productId = String(req.body?.product_id ?? '');
    const product = IAP_PRODUCTS.find((p) => p.product_id === productId);

    if (!product) {
      res.status(400).json({ error: '无效的商品' });
      return;
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('iap_orders')
      .insert({
        user_id: userId,
        product_id: product.product_id,
        credits: product.credits,
        price_cents: product.price_cents,
        currency: product.currency,
        status: 'pending',
        platform: 'sandbox',
      })
      .select('id, product_id, credits, price_cents, currency, status, platform, created_at')
      .single();

    if (error) throw new Error(`创建订单失败: ${error.message}`);
    res.json({ order: data });
  } catch (error: any) {
    console.error('Create order error:', error);
    res.status(500).json({ error: error.message ?? '创建订单失败' });
  }
});

/**
 * 服务端文件：server/src/routes/billing.ts
 * 接口：POST /api/v1/billing/orders/:id/verify
 * Headers: x-session: string
 * Body 参数：transaction_id?: string（真实 IAP 时传 Apple 交易凭证 ID）
 * 返回：发货结果（order + messages_remaining）
 *
 * 发货流程：校验订单归属与状态 → 标记 delivered → messages_remaining += credits
 * 幂等：已 delivered 的订单不会重复发货
 */
router.post('/orders/:id/verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const orderId = String(req.params.id ?? '');
    const transactionId = req.body?.transaction_id
      ? String(req.body.transaction_id)
      : `SANDBOX_${Date.now()}`;

    const admin = getSupabaseClient(); // service role：绕过 RLS 完成发货

    // 1. 查订单（归属校验）
    const { data: order, error: orderError } = await admin
      .from('iap_orders')
      .select('id, user_id, credits, status, delivered_at')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) throw new Error(`查询订单失败: ${orderError.message}`);
    if (!order || order.user_id !== userId) {
      res.status(404).json({ error: '订单不存在' });
      return;
    }

    // 2. 幂等：已发货直接返回
    if (order.status === 'delivered') {
      const { data: profile } = await admin
        .from('user_profiles')
        .select('messages_remaining')
        .eq('user_id', userId)
        .maybeSingle();
      res.json({
        order,
        messages_remaining: profile?.messages_remaining ?? null,
        already_delivered: true,
      });
      return;
    }

    // 3. 标记已支付并发货（同一事务语义：先置 delivered 再加次数）
    const { data: delivered, error: updateError } = await admin
      .from('iap_orders')
      .update({ status: 'delivered', transaction_id: transactionId, delivered_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status', 'paid')
      .select('id, credits, status')
      .maybeSingle();

    if (updateError) throw new Error(`更新订单失败: ${updateError.message}`);

    let creditsToDeliver: number;
    if (delivered) {
      creditsToDeliver = delivered.credits;
    } else {
      // pending → paid 一步完成（沙盒模式支付即到账）
      const { data: paid, error: paidError } = await admin
        .from('iap_orders')
        .update({ status: 'paid' })
        .eq('id', orderId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();
      if (paidError || !paid) {
        res.status(400).json({ error: '订单状态异常，无法发货' });
        return;
      }
      const { data: redelivered, error: redeliverError } = await admin
        .from('iap_orders')
        .update({ status: 'delivered', transaction_id: transactionId, delivered_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('status', 'paid')
        .select('id, credits, status')
        .maybeSingle();
      if (redeliverError || !redelivered) throw new Error('发货失败，请稍后重试');
      creditsToDeliver = redelivered.credits;
    }

    // 4. 次数到账
    const { data: profile, error: profileError } = await admin
      .from('user_profiles')
      .select('messages_remaining')
      .eq('user_id', userId)
      .maybeSingle();
    if (profileError || !profile) throw new Error('查询用户资料失败');

    const { data: updated, error: incrError } = await admin
      .from('user_profiles')
      .update({
        messages_remaining: profile.messages_remaining + creditsToDeliver,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select('messages_remaining')
      .single();
    if (incrError) throw new Error(`充值到账失败: ${incrError.message}`);

    res.json({
      order: { ...order, status: 'delivered', transaction_id: transactionId, credits: creditsToDeliver },
      messages_remaining: updated.messages_remaining,
      already_delivered: false,
    });
  } catch (error: any) {
    console.error('Verify order error:', error);
    res.status(500).json({ error: error.message ?? '发货失败' });
  }
});

/**
 * 服务端文件：server/src/routes/billing.ts
 * 接口：GET /api/v1/billing/orders
 * Headers: x-session: string
 * 返回：当前用户的充值订单历史（倒序，最多 50 条）
 */
router.get('/orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('iap_orders')
      .select('id, product_id, credits, price_cents, currency, status, platform, created_at, delivered_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(`查询订单失败: ${error.message}`);
    res.json({ orders: data ?? [] });
  } catch (error: any) {
    console.error('List orders error:', error);
    res.status(500).json({ error: error.message ?? '查询订单失败' });
  }
});

export default router;
