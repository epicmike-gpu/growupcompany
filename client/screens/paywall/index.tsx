import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  fetchProducts,
  purchaseProduct,
  type BillingProduct,
} from '@/services/purchase';
import { useFocusEffect } from 'expo-router';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function PaywallScreen() {
  const router = useSafeRouter();
  const { user } = useAuth();
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchProducts();
      setProducts(list);
      // 默认选中主推档（最受欢迎），无则选第一档
      const preferred =
        list.find((p) => p.tag === '最受欢迎') ?? list[0] ?? null;
      setSelected(preferred?.product_id ?? null);

      const { data } = await getSupabaseClient().auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        const res = await fetch(
          `${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/profile`,
          { headers: { 'x-session': token } },
        );
        if (res.ok) {
          const profile = await res.json();
          setRemaining(profile?.messages_remaining ?? 0);
          setIsPremium(profile?.subscription_type === 'premium');
        }
      }
    } catch {
      Alert.alert('加载失败', '商品信息加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  const handleBuy = useCallback(async () => {
    if (!selected || paying) return;
    const product = products.find((p) => p.product_id === selected);
    if (!product) return;

    const { data } = await getSupabaseClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      Alert.alert('请先登录', '登录后才能充值哦');
      return;
    }

    setPaying(true);
    try {
      const result = await purchaseProduct(token, product.product_id);
      setRemaining(result.remaining);
      Alert.alert(
        '充值成功',
        `已到账 ${result.credits_added} 次聊天机会，剩余 ${result.remaining} 次！`,
        [{ text: '太好了', onPress: () => router.back() }],
      );
    } catch (err) {
      Alert.alert(
        '支付未完成',
        err instanceof Error ? err.message : '支付失败，请稍后重试',
      );
    } finally {
      setPaying(false);
    }
  }, [selected, products, paying, router]);

  const selectedProduct = products.find((p) => p.product_id === selected);

  return (
    <Screen backgroundColor="#F0EDFA" safeAreaEdges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* 顶部栏 */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <FontAwesome6 name="arrow-left" size={18} color="#7C5CFC" />
          </TouchableOpacity>
          <Text style={styles.title}>充值次数</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* 游客提示条：引导先登录，防止购买记录随设备丢失 */}
          {user?.is_anonymous && (
            <TouchableOpacity
              style={styles.guestBanner}
              activeOpacity={0.85}
              onPress={() => router.push('/login')}
            >
              <FontAwesome6 name="triangle-exclamation" size={16} color="#B45309" />
              <Text style={styles.guestBannerText}>
                游客模式下购买的次数仅保存在本机，卸载或换手机会丢失。建议先登录再充值
              </Text>
              <FontAwesome6 name="chevron-right" size={13} color="#B45309" />
            </TouchableOpacity>
          )}
          {/* 余额卡 */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceIconWrap}>
              <FontAwesome6 name="star" size={22} color="#FFD54F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.balanceLabel}>
                {isPremium ? '会员权益生效中' : '当前剩余次数'}
              </Text>
              <Text style={styles.balanceValue}>
                {remaining === null ? '--' : `${remaining} 次`}
              </Text>
            </View>
            <FontAwesome6 name="wand-magic-sparkles" size={20} color="#C5B8FF" />
          </View>

          {/* 商品列表 */}
          {loading ? (
            <ActivityIndicator color="#7C5CFC" style={{ marginTop: 60 }} />
          ) : (
            products.map((p) => {
              const active = p.product_id === selected;
              return (
                <TouchableOpacity
                  key={p.product_id}
                  style={[styles.productCard, active && styles.productCardActive]}
                  onPress={() => setSelected(p.product_id)}
                  activeOpacity={0.85}
                >
                  {p.tag ? (
                    <View style={styles.tagWrap}>
                      <Text style={styles.tagText}>{p.tag}</Text>
                    </View>
                  ) : null}
                  <View style={styles.productLeft}>
                    <View style={styles.productIconWrap}>
                      <FontAwesome6 name="comments" size={20} color="#7C5CFC" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productTitle}>{p.title}</Text>
                      <Text style={styles.productDesc} numberOfLines={1}>
                        {p.subtitle}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.productPrice}>
                    ${(p.price_cents / 100).toFixed(2)}
                  </Text>
                  <View
                    style={[styles.radio, active && styles.radioActive]}
                  >
                    {active ? (
                      <FontAwesome6 name="check" size={12} color="#FFFFFF" />
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {/* 说明 */}
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>温馨提示</Text>
            <Text style={styles.noticeText}>
              · 次数永久有效，用完可随时续充{'\n'}
              · 每次和小精灵对话消耗 1 次{'\n'}
              · 支付遇到问题请联系爸爸妈妈帮忙
            </Text>
          </View>
        </ScrollView>

        {/* 底部支付按钮 */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.payBtn, paying && { opacity: 0.7 }]}
            onPress={handleBuy}
            disabled={paying || !selected}
            activeOpacity={0.85}
          >
            {paying ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.payBtnText}>
                {selectedProduct
                  ? `$${(selectedProduct.price_cents / 100).toFixed(2)} 立即充值`
                  : '请选择充值档位'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#2D2A45',
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  guestBannerText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#B45309',
    fontWeight: '500',
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  balanceIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#FFF7E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceLabel: { fontSize: 13, color: '#8B87A8' },
  balanceValue: { fontSize: 26, fontWeight: '800', color: '#2D2A45', marginTop: 2 },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  productCardActive: { borderColor: '#7C5CFC', backgroundColor: '#F7F4FF' },
  tagWrap: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#FF7043',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  productLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  productIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFEBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productTitle: { fontSize: 16, fontWeight: '700', color: '#2D2A45' },
  productDesc: { fontSize: 12, color: '#8B87A8', marginTop: 2 },
  productPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#7C5CFC',
    marginRight: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#DDD6F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { backgroundColor: '#7C5CFC', borderColor: '#7C5CFC' },
  noticeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginTop: 8,
  },
  noticeTitle: { fontSize: 14, fontWeight: '700', color: '#2D2A45', marginBottom: 8 },
  noticeText: { fontSize: 13, color: '#8B87A8', lineHeight: 22 },
  footer: { paddingHorizontal: 20, paddingBottom: 10, paddingTop: 6 },
  payBtn: {
    backgroundColor: '#7C5CFC',
    borderRadius: 24,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  payBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
});
