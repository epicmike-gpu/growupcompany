/**
 * 喝水提醒工具
 *
 * 1. 根据小朋友年龄计算喝水间隔（依据儿科饮水建议：年龄越小间隔越短）
 * 2. 系统本地通知调度（循环提醒，离开 App 也能收到）
 * 3. 通知权限申请
 *
 * 注意：Expo Go (Android) 不支持 expo-notifications，所有通知调用均 try-catch 降级，
 * 不影响开关保存与聊天内提醒（聊天内提醒不依赖通知权限）。
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 前台收到通知时也展示横幅 + 声音
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const WATER_NOTIFY_ID_KEY = 'water_reminder_notification_id';

/**
 * 年龄 → 喝水间隔（分钟）
 * 3-4岁: 30 分钟 | 5-6岁: 40 分钟 | 7-8岁: 50 分钟 | 9-10岁: 60 分钟 | 11岁+: 75 分钟
 */
export function getWaterIntervalMinutes(age: number): number {
  const a = Math.max(3, Math.min(Number(age) || 5, 14));
  if (a <= 4) return 30;
  if (a <= 6) return 40;
  if (a <= 8) return 50;
  if (a <= 10) return 60;
  return 75;
}

/**
 * 申请通知权限（首次会弹系统授权框）
 * 返回是否获得权限；Expo Go Android 等不支持环境返回 false
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (current.status === 'undetermined' || !current.canAskAgain) {
      const req = await Notifications.requestPermissionsAsync();
      return req.granted;
    }
    return false;
  } catch {
    // Expo Go Android 不支持通知 API
    return false;
  }
}

/**
 * 开启喝水本地通知：每 interval 分钟循环提醒一次
 * 成功返回 true；不支持通知的环境返回 false（降级为仅 App 内提醒）
 */
export async function scheduleWaterReminder(
  intervalMinutes: number,
  age: number,
): Promise<boolean> {
  try {
    // 先清掉旧的，避免重复调度
    await cancelWaterReminder();

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '小水壶来啦',
        body: waterNotifyBody(age),
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(intervalMinutes, 1) * 60,
        repeats: true,
      },
    });
    await AsyncStorage.setItem(WATER_NOTIFY_ID_KEY, id);
    return true;
  } catch {
    return false;
  }
}

/** 关闭喝水本地通知 */
export async function cancelWaterReminder(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(WATER_NOTIFY_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(WATER_NOTIFY_ID_KEY);
    }
  } catch {
    // 忽略：不支持通知的环境
  }
}

/** 通知文案（按年龄段微调） */
export function waterNotifyBody(age: number): string {
  const a = Number(age) || 5;
  if (a <= 5) return '宝贝，放下小玩具，喝口水休息一下吧，小肚子在等你喂它喝水哦！';
  if (a <= 8) return '喝口水休息一下吧！水宝宝说它想给身体加加油啦！';
  return '记得喝口水哦，保持水分充足，学习和玩耍都更有精神！';
}

/** 聊天内精灵喝水提醒话术（随机轮换） */
export const WATER_CHAT_LINES: string[] = [
  '聊了这么久啦，喝口水休息一下吧，小水壶都等急啦！',
  '嘀嘀——小水壶来查岗啦！喝口水，让嗓子润一润～',
  '我来给你添加油啦！喝口水，我们继续玩～',
  '嘴巴说了这么多话，一定渴了吧？快喝口水奖励一下自己！',
  '喝水时间到！水宝宝想进去你的肚子里探险啦～',
];
