import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Screen } from '@/components/Screen';
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

const AGES = [3, 4, 5, 6, 7, 8, 9, 10];

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAgePicker, setShowAgePicker] = useState(false);

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

  const handleUpdateAge = async (age: number) => {
    try {
      const token = session?.access_token;
      if (!token) return;

      /**
       * 服务端文件：server/src/routes/profile.ts
       * 接口：PUT /api/v1/profile/age
       * Body 参数：age: number
       */
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/profile/age`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-session': token,
        },
        body: JSON.stringify({ age }),
      });

      if (response.ok) {
        setProfile((prev) => (prev ? { ...prev, age } : prev));
        setShowAgePicker(false);
      }
    } catch (error) {
      console.error('Update age error:', error);
    }
  };

  const handleUpgrade = () => {
    Alert.alert(
      '升级会员',
      '成为会员后，你可以无限次使用成长精灵的所有功能！\n\n会员价格：¥19.9/月\n\n（此为演示，暂不支持实际支付）',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认升级',
          onPress: async () => {
            try {
              const token = session?.access_token;
              if (!token) return;

              /**
               * 服务端文件：server/src/routes/profile.ts
               * 接口：POST /api/v1/profile/subscribe
               * Body 参数：无
               */
              const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/profile/subscribe`, {
                method: 'POST',
                headers: { 'x-session': token },
              });

              if (response.ok) {
                setProfile((prev) =>
                  prev ? { ...prev, subscription_type: 'premium' } : prev
                );
                Alert.alert('升级成功', '恭喜你成为会员！现在可以无限次使用所有功能啦！');
              }
            } catch (error) {
              console.error('Subscribe error:', error);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert('退出登录', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      { text: '确定', style: 'destructive', onPress: () => signOut() },
    ]);
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

  return (
    <Screen>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <FontAwesome6 name="child" size={32} color="#7C5CFC" solid />
          </View>
          <Text style={styles.nickname}>{profile?.nickname || '小朋友'}</Text>
          <View style={[styles.badge, isPremium ? styles.premiumBadge : styles.freeBadge]}>
            <FontAwesome6
              name={isPremium ? 'crown' : 'star'}
              size={12}
              color={isPremium ? '#FFCB57' : '#8B87A0'}
              solid
            />
            <Text style={[styles.badgeText, isPremium && styles.premiumBadgeText]}>
              {isPremium ? '会员' : '免费用户'}
            </Text>
          </View>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile?.age || '--'}</Text>
            <Text style={styles.statLabel}>岁</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {isPremium ? '∞' : profile?.messages_remaining ?? 0}
            </Text>
            <Text style={styles.statLabel}>剩余次数</Text>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>设置</Text>

          {/* Age Setting */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setShowAgePicker(!showAgePicker)}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#E3F6FD' }]}>
                <FontAwesome6 name="cake-candles" size={18} color="#4FC3F7" solid />
              </View>
              <Text style={styles.settingLabel}>年龄设置</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>{profile?.age ? `${profile.age}岁` : '未设置'}</Text>
              <FontAwesome6 name="chevron-down" size={14} color="#8B87A0" />
            </View>
          </TouchableOpacity>

          {/* Age Picker */}
          {showAgePicker && (
            <View style={styles.agePicker}>
              {AGES.map((age) => (
                <TouchableOpacity
                  key={age}
                  style={[
                    styles.ageOption,
                    profile?.age === age && styles.ageOptionActive,
                  ]}
                  onPress={() => handleUpdateAge(age)}
                >
                  <Text
                    style={[
                      styles.ageOptionText,
                      profile?.age === age && styles.ageOptionTextActive,
                    ]}
                  >
                    {age}岁
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Subscription */}
          {!isPremium && (
            <TouchableOpacity style={styles.settingItem} onPress={handleUpgrade}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#FFF4DD' }]}>
                  <FontAwesome6 name="crown" size={18} color="#FFCB57" solid />
                </View>
                <Text style={styles.settingLabel}>升级会员</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={styles.settingValue}>¥19.9/月</Text>
                <FontAwesome6 name="chevron-right" size={14} color="#8B87A0" />
              </View>
            </TouchableOpacity>
          )}

          {/* Sign Out */}
          <TouchableOpacity style={styles.settingItem} onPress={handleSignOut}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#FFE8EE' }]}>
                <FontAwesome6 name="right-from-bracket" size={18} color="#FF8FAB" solid />
              </View>
              <Text style={styles.settingLabel}>退出登录</Text>
            </View>
            <FontAwesome6 name="chevron-right" size={14} color="#8B87A0" />
          </TouchableOpacity>
        </View>
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
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EDE8FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  nickname: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2D2B3D',
    marginTop: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    gap: 6,
  },
  freeBadge: {
    backgroundColor: '#F0EDFA',
  },
  premiumBadge: {
    backgroundColor: '#FFF4DD',
    borderWidth: 1.5,
    borderColor: 'rgba(255,203,87,0.3)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B87A0',
  },
  premiumBadgeText: {
    color: '#B8860B',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2D2B3D',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8B87A0',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#EDE8FF',
  },
  settingsSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2D2B3D',
    marginBottom: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2B3D',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B87A0',
  },
  agePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  ageOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#F0EDFA',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  ageOptionActive: {
    backgroundColor: '#EDE8FF',
    borderColor: '#7C5CFC',
  },
  ageOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8B87A0',
  },
  ageOptionTextActive: {
    color: '#7C5CFC',
  },
});
