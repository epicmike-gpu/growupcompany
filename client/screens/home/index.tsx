import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
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

const COMMANDS = [
  { type: 'drink_water', label: '喝水', icon: 'glass-water', color: '#4FC3F7', bg: '#E3F6FD', shadow: '#4FC3F7' },
  { type: 'sleep', label: '睡觉', icon: 'moon', color: '#7C5CFC', bg: '#EDE8FF', shadow: '#7C5CFC' },
  { type: 'rest', label: '休息', icon: 'couch', color: '#FF8FAB', bg: '#FFE8EE', shadow: '#FF8FAB' },
  { type: 'bath', label: '洗澡', icon: 'bath', color: '#26C6DA', bg: '#E0F7FA', shadow: '#26C6DA' },
  { type: 'eat_vegetables', label: '吃蔬菜', icon: 'carrot', color: '#5ED6A0', bg: '#E0F8EC', shadow: '#5ED6A0' },
  { type: 'brush_teeth', label: '刷牙', icon: 'tooth', color: '#FFCB57', bg: '#FFF4DD', shadow: '#FFCB57' },
  { type: 'exercise', label: '运动', icon: 'dumbbell', color: '#FF7043', bg: '#FFF0EC', shadow: '#FF7043' },
  { type: 'study', label: '学习', icon: 'book', color: '#AB47BC', bg: '#F3E5F5', shadow: '#AB47BC' },
];

const LEARN_CARD = { label: '学英语', icon: 'graduation-cap', color: '#FF7043', bg: '#FFF0EC', shadow: '#FF7043' };

export default function HomeScreen() {
  const router = useSafeRouter();
  const { session } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
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

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  const handleCommand = (commandType: string) => {
    // commandId: 唯一标识本次指令进入，聊天页据此判断是否需要发送初始指令消息
    const payload = { command_type: commandType, commandId: Date.now() };
    // navigate 到 tab 内页面语义更正确；冷启动后导航树刚就绪的瞬间 push 事件可能被丢弃，
    // 延迟重试一次兜底（两次携带相同 commandId，聊天页不会重复发送指令）
    router.navigate('/chat', payload);
    setTimeout(() => {
      router.navigate('/chat', payload);
    }, 250);
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C5CFC" />
        </View>
      </Screen>
    );
  }

  const isPremium = profile?.subscription_type === 'premium';
  const remaining = profile?.messages_remaining ?? 0;

  return (
    <Screen>
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
        <View style={styles.heroCard}>
          <View style={styles.heroIconContainer}>
            <FontAwesome6 name="star" size={36} color="#FFFFFF" solid />
          </View>
          <Text style={styles.heroTitle}>成长陪伴精灵</Text>
          <Text style={styles.heroSubtitle}>点击下方卡片，让精灵陪你完成任务吧!</Text>
        </View>

        {/* Command Grid */}
        <Text style={styles.sectionTitle}>选择任务</Text>
        <View style={styles.commandGrid}>
          {COMMANDS.map((cmd) => (
            <TouchableOpacity
              key={cmd.type}
              style={[styles.commandCard, { backgroundColor: cmd.bg }]}
              onPress={() => handleCommand(cmd.type)}
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
        </View>

        {/* Free Chat */}
        <TouchableOpacity
          style={[styles.freeChatCard, styles.actionCard]}
          onPress={() => handleCommand('free_chat')}
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
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
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
  commandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 28,
    gap: 12,
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
