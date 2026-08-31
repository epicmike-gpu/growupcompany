/**
 * 购买服务（次数充值）
 *
 * 当前实现：模拟收银台模式（业务闭环完整：下单 → 支付 → 发货校验 → 次数到账）
 *
 * ★ 真实 IAP 接入点（上架 App Store 时）：
 * 1. 安装 react-native-iap（需要 EAS Build / dev build，Expo Go 不支持原生 StoreKit）
 *    cd client && npx expo install react-native-iap
 * 2. 在 purchaseProduct() 中标记的位置调用 initConnection() / requestPurchase()，
 *    拿到 Apple transactionId 后再调 verify 接口，由后端向 Apple 校验收据后发货
 * 3. App Store Connect 后台创建与 PRODUCTS 表一致的 IAP 商品（消耗型）
 */
import { getSupabaseClient } from '../lib/supabase';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_BASE_URL ?? '';

export interface BillingProduct {
  product_id: string;
  title: string;
  subtitle: string;
  credits: number;
  price_cents: number;
  currency: string;
  tag: string | null;
}

export interface PurchaseResult {
  order_id: string;
  credits_added: number;
  remaining: number;
}

/**
 * 服务端文件：server/src/routes/billing.ts
 * 接口：GET /api/v1/billing/products
 * 返回：商品配置列表（无参数）
 */
export async function fetchProducts(): Promise<BillingProduct[]> {
  const res = await fetch(`${BACKEND}/api/v1/billing/products`);
  const json = await res.json();
  return json.products ?? [];
}

/**
 * 服务端文件：server/src/routes/billing.ts
 * 接口：POST /api/v1/billing/orders
 * Header：x-session: string（Supabase access token）
 * Body 参数：product_id: string
 * 返回：订单（id, status 等）
 */
async function createOrder(session: string, productId: string) {
  const res = await fetch(`${BACKEND}/api/v1/billing/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session': session },
    body: JSON.stringify({ product_id: productId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? '创建订单失败');
  return json.order as { id: string; status: string };
}

/**
 * 服务端文件：server/src/routes/billing.ts
 * 接口：POST /api/v1/billing/orders/:orderId/verify
 * Header：x-session: string
 * Body 参数：transaction_id: string（真实 IAP 为 Apple 交易号；模拟模式传模拟号）
 * 返回：{ order_id, credits_added, remaining }
 */
async function verifyOrder(session: string, orderId: string, transactionId: string): Promise<PurchaseResult> {
  const res = await fetch(
    `${BACKEND}/api/v1/billing/orders/${orderId}/verify`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session': session },
      body: JSON.stringify({ transaction_id: transactionId }),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? '发货校验失败');
  return json;
}

/**
 * 购买流程封装
 * 模拟模式：弹出确认（由调用方 UI 决定）→ 模拟支付 → verify 发货
 * 真实模式：requestPurchase() → Apple 回调 transaction → verify 发货
 */
export async function purchaseProduct(
  session: string,
  productId: string,
): Promise<PurchaseResult> {
  const order = await createOrder(session, productId);

  // ★ 真实 IAP 接入点：此处改为 react-native-iap 的 requestPurchase()
  //   并把 Apple 返回的 transactionId 传给 verifyOrder()
  const mockTransactionId = `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return verifyOrder(session, order.id, mockTransactionId);
}
