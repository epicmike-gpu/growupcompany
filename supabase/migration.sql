-- ============================================================
-- GrowUp App - Supabase 全量初始化脚本
-- 用法：Supabase Dashboard → SQL Editor → New query → 粘贴全文 → Run
-- 说明：chat_messages 历史测试对话不迁移（均为测试数据）
-- ============================================================

-- 1. 用户资料表
CREATE TABLE IF NOT EXISTS user_profiles (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nickname character varying,
  age integer,
  subscription_type character varying NOT NULL DEFAULT 'free',
  messages_remaining integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  water_reminder_enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_user_id_key UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS user_profiles_user_id_idx ON public.user_profiles USING btree (user_id);

-- 2. 聊天消息表
CREATE TABLE IF NOT EXISTS chat_messages (
  id character varying NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role character varying NOT NULL,
  content text NOT NULL,
  command_type character varying,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON public.chat_messages USING btree (user_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON public.chat_messages USING btree (created_at);

-- 3. IAP 订单表
CREATE TABLE IF NOT EXISTS iap_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id text NOT NULL,
  credits integer NOT NULL,
  price_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'CNY',
  status text NOT NULL DEFAULT 'pending',
  platform text NOT NULL DEFAULT 'sandbox',
  transaction_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  CONSTRAINT iap_orders_pkey PRIMARY KEY (id)
);

-- 4. 健康检查表
CREATE TABLE IF NOT EXISTS health_check (
  id serial NOT NULL,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT health_check_pkey PRIMARY KEY (id)
);

-- 5. 启用行级安全（RLS）
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_orders ENABLE ROW LEVEL SECURITY;

-- 6. RLS 策略（用户只能读写自己的数据）
CREATE POLICY "user_profiles_用户读取自己的数据" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_profiles_用户插入自己的数据" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_profiles_用户更新自己的数据" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "chat_messages_用户读取自己的数据" ON chat_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chat_messages_用户插入自己的数据" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users view own orders" ON iap_orders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own orders" ON iap_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 完成！后续请：
-- 1) Storage 里创建私有 bucket：audio
-- 2) Authentication → Providers → Apple 填入 .p8/Key ID/Team ID/com.growupcompany.app
-- 3) Authentication → Sign In / Up 开启 Anonymous sign-ins
