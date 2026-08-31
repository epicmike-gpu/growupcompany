import express from "express";

const router = express.Router();

// 推荐任务定义（type 与聊天页 COMMAND_LABELS 对齐，点击后直接作为指令进入聊天）
interface TaskDef {
  type: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
  shadow: string;
  reason: string; // 推荐理由（面向儿童的话术）
  minAge: number;
  maxAge: number;
  slots: TimeSlot[];
}

type TimeSlot = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

const TASK_POOL: TaskDef[] = [
  // ===== 早晨 =====
  {
    type: 'brush_teeth', label: '刷牙', icon: 'tooth',
    color: '#FFCB57', bg: '#FFF4DD', shadow: '#FFCB57',
    reason: '早上刷刷牙，牙齿白白亮晶晶！',
    minAge: 3, maxAge: 10, slots: ['morning', 'night'],
  },
  {
    type: 'drink_water', label: '喝水', icon: 'glass-water',
    color: '#4FC3F7', bg: '#E3F6FD', shadow: '#4FC3F7',
    reason: '起床后喝杯水，身体咕嘟咕嘟醒过来！',
    minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening'],
  },
  {
    type: 'exercise', label: '运动', icon: 'dumbbell',
    color: '#FF7043', bg: '#FFF0EC', shadow: '#FF7043',
    reason: '太阳出来啦，蹦蹦跳跳长高高！',
    minAge: 3, maxAge: 10, slots: ['morning', 'afternoon'],
  },
  {
    type: 'dress_up', label: '自己穿衣', icon: 'shirt',
    color: '#FFA726', bg: '#FFF3E0', shadow: '#FFA726',
    reason: '小勇士自己变身，穿衣服超厉害！',
    minAge: 3, maxAge: 10, slots: ['morning'],
  },
  {
    type: 'pack_bag', label: '收拾书包', icon: 'bag-shopping',
    color: '#8D6E63', bg: '#F1EAE4', shadow: '#8D6E63',
    reason: '宝贝们要归队啦，书包寻宝开始！',
    minAge: 5, maxAge: 10, slots: ['morning', 'evening'],
  },
  {
    type: 'eat_fruit', label: '吃水果', icon: 'apple-whole',
    color: '#EF5350', bg: '#FFEBEE', shadow: '#EF5350',
    reason: '维他命小能量兵，吃了变聪明！',
    minAge: 3, maxAge: 10, slots: ['morning', 'afternoon'],
  },
  // ===== 中午 =====
  {
    type: 'eat_vegetables', label: '吃蔬菜', icon: 'carrot',
    color: '#5ED6A0', bg: '#E0F8EC', shadow: '#5ED6A0',
    reason: '午饭时间到，蔬菜宝宝等你哦！',
    minAge: 3, maxAge: 10, slots: ['noon', 'evening'],
  },
  {
    type: 'rest', label: '休息', icon: 'couch',
    color: '#FF8FAB', bg: '#FFE8EE', shadow: '#FF8FAB',
    reason: '午睡一小会儿，下午更有精神玩！',
    minAge: 3, maxAge: 8, slots: ['noon'],
  },
  {
    type: 'nap', label: '午睡', icon: 'bed',
    color: '#9575CD', bg: '#EDE7F6', shadow: '#9575CD',
    reason: '给身体充充电，睡醒元气满满！',
    minAge: 3, maxAge: 8, slots: ['noon'],
  },
  {
    type: 'wash_hands', label: '饭前洗手', icon: 'pump-soap',
    color: '#4DD0E1', bg: '#E0F7FA', shadow: '#4DD0E1',
    reason: '泡泡魔法出发，赶走细菌小怪兽！',
    minAge: 3, maxAge: 10, slots: ['noon', 'evening'],
  },
  {
    type: 'study', label: '学习', icon: 'book',
    color: '#AB47BC', bg: '#F3E5F5', shadow: '#AB47BC',
    reason: '读一会儿书，知识悄悄钻进小脑袋！',
    minAge: 6, maxAge: 10, slots: ['noon', 'afternoon', 'evening'],
  },
  // ===== 下午 =====
  {
    type: 'rest', label: '休息眼睛', icon: 'couch',
    color: '#FF8FAB', bg: '#FFE8EE', shadow: '#FF8FAB',
    reason: '玩了这么久，让眼睛休息一下吧！',
    minAge: 3, maxAge: 10, slots: ['afternoon'],
  },
  {
    type: 'exercise', label: '户外运动', icon: 'dumbbell',
    color: '#FF7043', bg: '#FFF0EC', shadow: '#FF7043',
    reason: '下午天气真好，出去跑一跑吧！',
    minAge: 6, maxAge: 10, slots: ['afternoon'],
  },
  {
    type: 'sit_straight', label: '坐姿端正', icon: 'chair',
    color: '#66BB6A', bg: '#E8F5E9', shadow: '#66BB6A',
    reason: '像小树苗一样挺拔，眼睛更明亮！',
    minAge: 5, maxAge: 10, slots: ['afternoon', 'evening'],
  },
  {
    type: 'free_chat', label: '聊聊天', icon: 'comments',
    color: '#7C5CFC', bg: '#EDE8FF', shadow: '#7C5CFC',
    reason: '精灵想听听你今天的新鲜事！',
    minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'],
  },
  // ===== 晚上 =====
  {
    type: 'bath', label: '洗澡', icon: 'bath',
    color: '#26C6DA', bg: '#E0F7FA', shadow: '#26C6DA',
    reason: '泡泡浴时间！洗得香香的真舒服～',
    minAge: 3, maxAge: 10, slots: ['evening', 'night'],
  },
  {
    type: 'study', label: '复习功课', icon: 'book',
    color: '#AB47BC', bg: '#F3E5F5', shadow: '#AB47BC',
    reason: '睡前温习一小会儿，明天更轻松！',
    minAge: 8, maxAge: 10, slots: ['evening'],
  },
  {
    type: 'breathe', label: '深呼吸', icon: 'wind',
    color: '#4FC3F7', bg: '#E3F6FD', shadow: '#4FC3F7',
    reason: '闻闻花香吹吹蜡烛，心里静悄悄～',
    minAge: 3, maxAge: 10, slots: ['evening', 'night'],
  },
  {
    type: 'praise_day', label: '今天真棒', icon: 'thumbs-up',
    color: '#FFD54F', bg: '#FFF8E1', shadow: '#FFD54F',
    reason: '精灵想夸夸今天厉害的你！',
    minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'],
  },
  {
    type: 'strength', label: '优点大发现', icon: 'medal',
    color: '#F06292', bg: '#FCE4EC', shadow: '#F06292',
    reason: '一起来挖一挖你身上的小宝藏！',
    minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'],
  },
  // ===== 夜晚 =====
  {
    type: 'brush_teeth', label: '睡前刷牙', icon: 'tooth',
    color: '#FFCB57', bg: '#FFF4DD', shadow: '#FFCB57',
    reason: '刷完牙再睡觉，蛀牙虫虫不敢来！',
    minAge: 3, maxAge: 10, slots: ['night'],
  },
  {
    type: 'sleep', label: '睡觉', icon: 'moon',
    color: '#7C5CFC', bg: '#EDE8FF', shadow: '#7C5CFC',
    reason: '月亮爬上来啦，小床在等你哦！',
    minAge: 3, maxAge: 10, slots: ['night'],
  },
];

function getTimeSlot(date = new Date()): TimeSlot {
  const h = date.getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 14) return 'noon';
  if (h >= 14 && h < 18) return 'afternoon';
  if (h >= 18 && h < 21) return 'evening';
  return 'night';
}

const SLOT_LABELS: Record<TimeSlot, string> = {
  morning: '早上好！新的一天开始啦',
  noon: '中午好！该吃午饭啦',
  afternoon: '下午好！玩累了吗',
  evening: '晚上好！今天过得开心吗',
  night: '夜深啦，准备休息吧',
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * GET /api/v1/tasks/recommended
 * Query 参数：age?: number（孩子年龄，缺省按全年龄段处理）
 * 返回：{ timeSlot, slotGreeting, tasks: TaskDef[] }（最多 2 个推荐任务）
 */
router.get('/recommended', (req, res) => {
  const ageParam = Number(req.query.age);
  const age = Number.isFinite(ageParam) && ageParam > 0 ? Math.floor(ageParam) : null;

  const timeSlot = getTimeSlot();
  const candidates = TASK_POOL.filter(
    (t) => t.slots.includes(timeSlot) && (age === null || (age >= t.minAge && age <= t.maxAge))
  );

  // 兜底：该时段没有匹配年龄的任务时，放宽年龄限制
  const pool = candidates.length > 0 ? candidates : TASK_POOL.filter((t) => t.slots.includes(timeSlot));

  const tasks = shuffle(pool).slice(0, 2);

  res.json({
    timeSlot,
    slotGreeting: SLOT_LABELS[timeSlot],
    tasks,
  });
});

export default router;
