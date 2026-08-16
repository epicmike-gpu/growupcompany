import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';

export default function TabLayout() {
  let tabBarStyle = {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: 70,
    paddingBottom: 8,
    paddingTop: 8,
  };

  if (Platform.OS === 'web') {
    tabBarStyle = {
      ...tabBarStyle,
      height: 'auto' as unknown as number,
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
