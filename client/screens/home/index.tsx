import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

interface UserProfile {
  id: string;
  nickname: string | null;
  age: number | null;
  subscription_type: string;
  messages_remaining: number;
}

// 服务端文件：server/src/routes/tasks.ts
// 接口：GET /api/v1/tasks/recommended
// Query 参数：age?: number（孩子年龄，来自 profile.age，缺省按全年龄段推荐）
interface RecommendedTask {
  type: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
  shadow: string;
  reason: string;
  command?: string;
}

interface RecommendedData {
  timeSlot: string;
  slotGreeting: string;
  tasks: RecommendedTask[];
}

// 服务端文件：server/src/routes/tasks.ts
// 接口：GET /api/v1/tasks/library
// Query 参数：无（全量拉取 100 条，搜索/分类在前端本地过滤）
interface LibraryCategory {
  key: string;
  label: string;
  icon: string;
  count: number;
}

interface LibraryTask {
  type: string;
  label: string;
  icon: string;
  category: string;
  color: string;
  bg: string;
  shadow: string;
  command: string;
  reason: string;
}

interface LibraryData {
  categories: LibraryCategory[];
  tasks: LibraryTask[];
}

const LEARN_CARD = { label: '学英语', icon: 'graduation-cap', color: '#FF7043', bg: '#FFF0EC', shadow: '#FF7043' };

/** 3D 持续旋转的精灵星星：绕 Y 轴匀速翻转，带透视立体感（双层星体 + 高光） */
function SpinningSprite({ size = 36 }: { size?: number }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 3600, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation]);

  const spriteStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      // rotation.value 是纯数字，先拼接单位字符串再用于 transform（避免 SharedValue 直接拼字符串）
      { rotateY: `${rotation.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        spriteStyle,
      ]}
    >
      <FontAwesome6 name="star" size={size} color="#FFD54A" solid />
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useSafeRouter();
  const { session } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recommended, setRecommended] = useState<RecommendedData | null>(null);
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [searchText, setSearchText] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const token = session?.access_token;
      if (!token) return;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/profile`, {
        headers: { 'x-session': token },
      });
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Fetch profile error:', error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const fetchRecommended = useCallback(async (age: number | null) => {
    try {
      const query = age ? `?age=${age}` : '';
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tasks/recommended${query}`
      );
      if (response.ok) {
        const data: RecommendedData = await response.json();
        setRecommended(data);
      }
    } catch (error) {
      console.error('Fetch recommended error:', error);
    }
  }, []);

  const fetchLibrary = useCallback(async () => {
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/tasks/library`
      );
      if (response.ok) {
        const data: LibraryData = await response.json();
        setLibrary(data);
      }
    } catch (error) {
      console.error('Fetch library error:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      fetchRecommended(profile?.age ?? null);
      fetchLibrary();
    }, [fetchProfile, fetchRecommended, fetchLibrary, profile?.age])
  );

  const handleCommand = (task: { type: string; command: string }) => {
    // commandId: 唯一标识本次指令进入，聊天页据此判断是否需要发送初始指令消息
    // commandText: 完整指令话术（赞美类与普通提醒话术不同），聊天页优先使用
    const payload = {
      command_type: task.type,
      commandText: task.command,
      commandId: Date.now(),
    };
    // navigate 到 tab 内页面语义更正确；冷启动后导航树刚就绪的瞬间 push 事件可能被丢弃，
    // 延迟重试一次兜底（两次携带相同 commandId，聊天页不会重复发送指令）
    router.navigate('/chat', payload);
    setTimeout(() => {
      router.navigate('/chat', payload);
    }, 250);
  };

  // 搜索 + 分类本地过滤（library 全量仅 100 条，本地过滤即时响应）
  const filteredTasks: LibraryTask[] = (library?.tasks ?? []).filter((t) => {
    if (activeCategory !== 'all' && t.category !== activeCategory) return false;
    const q = searchText.trim().toLowerCase();
    if (!q) return true;
    return t.label.toLowerCase().includes(q) || t.type.toLowerCase().includes(q);
  });

  // ===== 玻璃球星星弹跳（在紫色 Hero 卡内反弹后弹回家）=====
  const bounceX = useSharedValue(0);
  const bounceY = useSharedValue(0);
  const heroCardSize = useRef({ w: 0, h: 0 });
  const starHome = useRef({ x: 0, y: 0 });
  const bounceState = useRef({
    x: 0, y: 0, vx: 0, vy: 0, active: false, raf: 0, last: 0, elapsed: 0,
  });

  const starFlyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: bounceX.value },
      { translateY: bounceY.value },
    ],
  }));

  const startStarBounce = useCallback(() => {
    const st = bounceState.current;
    if (st.active) return; // 弹跳中忽略重复点击
    const { w, h } = heroCardSize.current;
    const home = starHome.current;
    if (w < 80 || h < 80) return; // 布局未就绪
    const minX = -home.x;
    const maxX = w - home.x - 56;
    const minY = -home.y;
    const maxY = h - home.y - 56;
    if (maxX <= minX + 8 || maxY <= minY + 8) return;

    cancelAnimation(bounceX);
    cancelAnimation(bounceY);
    // 从当前位置（可能是回位半途）继续弹
    st.x = bounceX.value;
    st.y = bounceY.value;
    st.vx = (Math.random() < 0.5 ? -1 : 1) * (170 + Math.random() * 90);
    st.vy = (Math.random() < 0.5 ? -1 : 1) * (140 + Math.random() * 90);
    st.elapsed = 0;
    st.last = 0;
    st.active = true;

    const step = (now: number) => {
      if (!st.last) st.last = now;
      const dt = Math.min((now - st.last) / 1000, 0.05);
      st.last = now;
      st.elapsed += dt;
      // 空气阻力：每秒保留约 62% 速度
      const decay = Math.pow(0.62, dt);
      st.vx *= decay;
      st.vy *= decay;
      st.x += st.vx * dt;
      st.y += st.vy * dt;
      // 撞壁反弹（恢复系数 0.85）
      if (st.x < minX) { st.x = minX; st.vx = Math.abs(st.vx) * 0.85; }
      else if (st.x > maxX) { st.x = maxX; st.vx = -Math.abs(st.vx) * 0.85; }
      if (st.y < minY) { st.y = minY; st.vy = Math.abs(st.vy) * 0.85; }
      else if (st.y > maxY) { st.y = maxY; st.vy = -Math.abs(st.vy) * 0.85; }
      bounceX.value = st.x;
      bounceY.value = st.y;
      const speed = Math.hypot(st.vx, st.vy);
      if (speed < 55 || st.elapsed > 3.2) {
        // 力量耗尽：弹簧弹回玻璃球原位
        st.active = false;
        bounceX.value = withSpring(0, { damping: 15, stiffness: 130 });
        bounceY.value = withSpring(0, { damping: 15, stiffness: 130 });
        return;
      }
      st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
  }, [bounceX, bounceY]);

  useEffect(() => {
    const st = bounceState.current;
    return () => {
      cancelAnimationFrame(st.raf);
      st.active = false;
    };
  }, []);

  if (loading) {
    return (
      <Screen backgroundColor="#F0EDFA">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C5CFC" />
        </View>
      </Screen>
    );
  }

  const isPremium = profile?.subscription_type === 'premium';
  const remaining = profile?.messages_remaining ?? 0;

  return (
    <Screen backgroundColor="#F0EDFA" safeAreaEdges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hi, {profile?.nickname || '小朋友'}!</Text>
            <Text style={styles.subGreeting}>今天想做什么呢?</Text>
          </View>
          <View style={styles.quotaBadge}>
            <FontAwesome6 name="star" size={14} color="#FFCB57" />
            <Text style={styles.quotaText}>
              {isPremium ? '会员' : `剩余 ${remaining} 次`}
            </Text>
          </View>
        </View>

        {/* Hero Card */}
        <View
          style={styles.heroCard}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            heroCardSize.current = { w: width, h: height };
          }}
        >
          <Animated.View
            style={[styles.heroIconContainer, starFlyStyle]}
            onLayout={(e) => {
              const { x, y } = e.nativeEvent.layout;
              starHome.current = { x, y };
            }}
          >
            {/* 玻璃球体：独立裁剪层（真实磨砂模糊 + 白雾 + 高光），星星不放进裁剪层，
                避免 iOS BlurView 与 3D transform 的渲染冲突导致星星被截断 */}
            <View style={styles.glassBall}>
              <BlurView
                intensity={30}
                tint="light"
                experimentalBlurMethod={
                  Platform.OS === 'android' ? 'dimezisBlurView' : undefined
                }
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View style={styles.glassBallTint} pointerEvents="none" />
              <View style={styles.glassBallHighlight} pointerEvents="none" />
            </View>
            {/* 星星悬浮在玻璃球面上，位于裁剪层之上；点击后带着玻璃球整体飞出弹跳 */}
            <View style={styles.heroIconCenter}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={startStarBounce}
                accessibilityLabel="弹跳的星星"
              >
                <SpinningSprite size={34} />
              </TouchableOpacity>
            </View>
          </Animated.View>
          <Text style={styles.heroTitle}>成长陪伴精灵</Text>
          <Text style={styles.heroSubtitle}>点击下方卡片，让精灵陪你完成任务吧!</Text>
        </View>

        {/* 额度用尽提示 */}
        {!isPremium && remaining <= 0 && (
          <TouchableOpacity
            style={styles.quotaBanner}
            activeOpacity={0.8}
            onPress={() => router.navigate('/paywall')}
          >
            <FontAwesome6 name="circle-exclamation" size={16} color="#FFF" solid />
            <Text style={styles.quotaBannerText}>聊天次数已经用完啦，请充值后再继续</Text>
            <Text style={styles.quotaBannerAction}>去充值</Text>
          </TouchableOpacity>
        )}

        {/* Recommended Tasks */}
        {recommended && recommended.tasks.length > 0 && (
          <View style={styles.recommendSection}>
            <View style={styles.recommendHeader}>
              <FontAwesome6 name="wand-magic-sparkles" size={16} color="#7C5CFC" solid />
              <Text style={styles.recommendTitle}>今日推荐</Text>
              <Text style={styles.recommendGreeting} numberOfLines={1}>
                {recommended.slotGreeting}
              </Text>
            </View>
            <View style={styles.recommendRow}>
              {recommended.tasks.map((task) => (
                <TouchableOpacity
                  key={`${task.type}-${task.label}`}
                  style={[styles.recommendCard, { backgroundColor: task.bg, shadowColor: task.shadow }]}
                  onPress={() =>
                  handleCommand({
                    type: task.type,
                    command: task.command ?? `请提醒我去${task.label}`,
                  })
                }
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.recommendIcon,
                      { backgroundColor: '#FFFFFF' },
                    ]}
                  >
                    <FontAwesome6 name={task.icon} size={20} color={task.color} solid />
                  </View>
                  <View style={styles.recommendText}>
                    <Text style={[styles.recommendTaskName, { color: task.color }]}>{task.label}</Text>
                    <Text style={styles.recommendReason} numberOfLines={2}>
                      {task.reason}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Command Grid */}
        {/* 搜索栏 */}
        <View style={styles.searchBar}>
          <FontAwesome6 name="magnifying-glass" size={16} color="#9A8FC7" />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索任务，如：喝水、刷牙"
            placeholderTextColor="#B5AEDB"
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchText('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <FontAwesome6 name="circle-xmark" size={16} color="#B5AEDB" />
            </TouchableOpacity>
          )}
        </View>

        {/* 分类筛选 chips */}
        {!searchText && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContent}
          >
            <TouchableOpacity
              style={[
                styles.categoryChip,
                activeCategory === 'all' && styles.categoryChipActive,
              ]}
              onPress={() => setActiveCategory('all')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  activeCategory === 'all' && styles.categoryChipTextActive,
                ]}
              >
                全部
              </Text>
            </TouchableOpacity>
            {(library?.categories ?? []).map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.categoryChip,
                  activeCategory === cat.key && styles.categoryChipActive,
                ]}
                onPress={() => setActiveCategory(cat.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    activeCategory === cat.key && styles.categoryChipTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Text style={styles.sectionTitle}>
          {searchText
            ? `搜索结果 (${filteredTasks.length})`
            : activeCategory === 'all'
              ? '选择任务'
              : `${(library?.categories ?? []).find((c) => c.key === activeCategory)?.label ?? ''}任务`}
        </Text>
        <View style={styles.commandGrid}>
          {filteredTasks.map((cmd) => (
            <TouchableOpacity
              key={cmd.type}
              style={[styles.commandCard, { backgroundColor: cmd.bg }]}
              onPress={() => handleCommand(cmd)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: cmd.bg,
                    shadowColor: cmd.shadow,
                  },
                ]}
              >
                <FontAwesome6 name={cmd.icon} size={28} color={cmd.color} solid />
              </View>
              <Text style={[styles.commandLabel, { color: cmd.color }]}>{cmd.label}</Text>
            </TouchableOpacity>
          ))}
          {filteredTasks.length === 0 && (
            <View style={styles.emptyResult}>
              <FontAwesome6 name="face-frown" size={36} color="#C9C2E8" />
              <Text style={styles.emptyResultText}>没有找到「{searchText}」相关任务</Text>
              <Text style={styles.emptyResultHint}>换个词试试，或看看其他分类</Text>
            </View>
          )}
        </View>

        {/* Free Chat */}
        <TouchableOpacity
          style={[styles.freeChatCard, styles.actionCard]}
          onPress={() =>
            handleCommand({ type: 'free_chat', command: '我们一起聊聊天吧' })
          }
          activeOpacity={0.8}
        >
          <View style={styles.freeChatIcon}>
            <FontAwesome6 name="comments" size={24} color="#7C5CFC" solid />
          </View>
          <View style={styles.freeChatText}>
            <Text style={styles.freeChatTitle}>自由聊天</Text>
            <Text style={styles.freeChatSubtitle}>和精灵随便聊聊吧~</Text>
          </View>
          <FontAwesome6 name="chevron-right" size={16} color="#8B87A0" />
        </TouchableOpacity>

        {/* English Learning */}
        <TouchableOpacity
          style={[styles.freeChatCard, styles.actionCard, { backgroundColor: LEARN_CARD.bg }]}
          onPress={() => router.push('/english')}
          activeOpacity={0.8}
        >
          <View style={[styles.freeChatIcon, { backgroundColor: '#FFF0EC' }]}>
            <FontAwesome6 name={LEARN_CARD.icon} size={24} color={LEARN_CARD.color} solid />
          </View>
          <View style={styles.freeChatText}>
            <Text style={[styles.freeChatTitle, { color: LEARN_CARD.color }]}>学英语</Text>
            <Text style={styles.freeChatSubtitle}>卡片对对碰，快乐学英语~</Text>
          </View>
          <FontAwesome6 name="chevron-right" size={16} color="#8B87A0" />
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0EDFA',
  },
  scrollContent: {
    paddingBottom: 100,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0EDFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2D2B3D',
  },
  subGreeting: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8B87A0',
    marginTop: 4,
  },
  quotaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    gap: 6,
  },
  quotaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2B3D',
  },
  heroCard: {
    backgroundColor: '#7C5CFC',
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#5A3ED9',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  heroIconContainer: {
    width: 56,
    height: 56,
    marginBottom: 8,
    zIndex: 10,
  },
  glassBall: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  heroIconCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassBallTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  glassBallHighlight: {
    position: 'absolute',
    top: 4,
    left: 7,
    width: 20,
    height: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
    transform: [{ rotate: '-24deg' }],
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2D2B3D',
    marginBottom: 16,
  },
  recommendSection: {
    marginBottom: 28,
  },
  quotaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF7043',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
    gap: 8,
    shadowColor: '#FF7043',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  quotaBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  quotaBannerAction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  recommendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  recommendTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2D2B3D',
  },
  recommendGreeting: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#8B87A0',
    textAlign: 'right',
  },
  recommendRow: {
    flexDirection: 'row',
    gap: 12,
  },
  recommendCard: {
    flex: 1,
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
  },
  recommendIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  recommendText: {
    flex: 1,
  },
  recommendTaskName: {
    fontSize: 15,
    fontWeight: '800',
  },
  recommendReason: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B6780',
    marginTop: 4,
    lineHeight: 15,
  },
  commandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 28,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E2DAFF',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#4A3F78',
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
  categoryScroll: {
    marginBottom: 14,
  },
  categoryScrollContent: {
    gap: 8,
    paddingRight: 20,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2DAFF',
  },
  categoryChipActive: {
    backgroundColor: '#7C5CFC',
    borderColor: '#7C5CFC',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8A7BB8',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  noResult: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  noResultText: {
    fontSize: 14,
    color: '#A99BC9',
  },
  categoryContent: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
  },
  emptyResult: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 6,
  },
  emptyResultText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8A82A8',
  },
  emptyResultHint: {
    fontSize: 12,
    color: '#B4AECB',
  },
  commandCard: {
    width: '47%',
    borderRadius: 24,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  commandLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  freeChatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 6,
    gap: 16,
  },
  actionCard: {
    marginBottom: 16,
  },
  freeChatIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#EDE8FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  freeChatText: {
    flex: 1,
  },
  freeChatTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D2B3D',
  },
  freeChatSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8B87A0',
    marginTop: 4,
  },
});
