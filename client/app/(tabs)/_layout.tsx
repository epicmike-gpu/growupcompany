import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  let tabBarStyle: Record<string, unknown> = {
    backgroundColor: '#F0EDFA',
    borderTopWidth: 0,
    height: 54 + insets.bottom,
    paddingBottom: 4 + insets.bottom,
    paddingTop: 4,
    elevation: 0,
  };

  // 用于修复 Web 上高度异常的问题
  if (Platform.OS === 'web') {
    tabBarStyle = {
      ...tabBarStyle,
      height: 'auto',
    };
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: '#7C5CFC',
        tabBarInactiveTintColor: '#C5C0DB',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700' as const,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color, focused }) => (
            <FontAwesome6 name="house" size={22} color={color} solid={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: '聊天',
          tabBarIcon: ({ color, focused }) => (
            <FontAwesome6 name="comments" size={22} color={color} solid={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color, focused }) => (
            <FontAwesome6 name="user" size={22} color={color} solid={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
