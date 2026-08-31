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
  category?: string; // 分类（赞美类指令使用专属话术）
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
    reason: '精灵想夸夸今天厉害的你！', category: 'praise',
    minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'],
  },
  {
    type: 'strength', label: '优点大发现', icon: 'medal',
    color: '#F06292', bg: '#FCE4EC', shadow: '#F06292',
    reason: '一起来挖一挖你身上的小宝藏！', category: 'praise',
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

// ==================== 指令库（100 种）====================
interface LibraryTaskDef {
  type: string;
  label: string;
  icon: string;
  category: CategoryKey;
  phrase: string;
  minAge: number;
  maxAge: number;
  slots: TimeSlot[];
}

type CategoryKey = 'life' | 'health' | 'study' | 'social' | 'play' | 'safety' | 'praise';

const TASK_CATEGORIES: { key: CategoryKey; label: string; icon: string; count: number }[] = [
  { key: 'life', label: '生活习惯', icon: 'boxes-stacked', count: 20 },
  { key: 'health', label: '健康身体', icon: 'heart-pulse', count: 15 },
  { key: 'study', label: '学习成长', icon: 'book', count: 15 },
  { key: 'social', label: '情绪社交', icon: 'face-smile', count: 15 },
  { key: 'play', label: '创意玩耍', icon: 'puzzle-piece', count: 15 },
  { key: 'safety', label: '安全守护', icon: 'shield-halved', count: 10 },
  { key: 'praise', label: '赞美鼓励', icon: 'star', count: 10 },
];

const TASK_LIBRARY: LibraryTaskDef[] = [
  // ===== 生活习惯 =====
  { type: 'drink_water', label: '喝水', icon: 'glass-water', category: 'life', phrase: '喝水能让身体像小河一样流动起来', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'sleep', label: '上床睡觉', icon: 'moon', category: 'life', phrase: '月亮出来了，小眼睛要闭上啦', minAge: 3, maxAge: 10, slots: ['night'] },
  { type: 'nap', label: '午睡', icon: 'bed', category: 'life', phrase: '午睡是给身体充电的小魔法', minAge: 3, maxAge: 8, slots: ['noon'] },
  { type: 'rest', label: '休息一下', icon: 'chair', category: 'life', phrase: '玩累了就要歇一歇再出发', minAge: 3, maxAge: 10, slots: ['noon', 'afternoon'] },
  { type: 'bath', label: '洗澡', icon: 'bath', category: 'life', phrase: '泡泡澡，变成香喷喷的小宝贝', minAge: 3, maxAge: 10, slots: ['evening', 'night'] },
  { type: 'brush_teeth', label: '刷牙', icon: 'tooth', category: 'life', phrase: '小牙刷赶走牙齿里的小蛀虫', minAge: 3, maxAge: 10, slots: ['morning', 'night'] },
  { type: 'wash_hands', label: '饭前洗手', icon: 'hands-bubbles', category: 'life', phrase: '泡泡魔法把小细菌统统赶跑', minAge: 3, maxAge: 10, slots: ['noon', 'evening', 'night'] },
  { type: 'dress_up', label: '自己穿衣', icon: 'shirt', category: 'life', phrase: '像小勇士一样自己变身成功', minAge: 3, maxAge: 10, slots: ['morning'] },
  { type: 'pack_bag', label: '收拾书包', icon: 'bag-shopping', category: 'life', phrase: '书包寻宝游戏现在开始', minAge: 5, maxAge: 10, slots: ['morning', 'evening'] },
  { type: 'tidy_up', label: '收拾玩具', icon: 'boxes-stacked', category: 'life', phrase: '送玩具宝宝回它们的小家', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'fold_clothes', label: '叠衣服', icon: 'layer-group', category: 'life', phrase: '小衣服叠叠好，变成小方块', minAge: 5, maxAge: 10, slots: ['morning', 'evening'] },
  { type: 'make_bed', label: '铺床铺', icon: 'house', category: 'life', phrase: '把小床铺得像云朵一样舒服', minAge: 4, maxAge: 10, slots: ['morning'] },
  { type: 'toilet', label: '如厕洗手', icon: 'toilet', category: 'life', phrase: '上厕所后要记得洗手哦', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'eat_meal', label: '好好吃饭', icon: 'utensils', category: 'life', phrase: '大口吃饭饭，身体棒棒', minAge: 3, maxAge: 10, slots: ['noon', 'evening'] },
  { type: 'breakfast', label: '吃早餐', icon: 'mug-saucer', category: 'life', phrase: '太阳公公喊你吃早餐啦', minAge: 3, maxAge: 10, slots: ['morning'] },
  { type: 'dinner', label: '吃晚餐', icon: 'bowl-food', category: 'life', phrase: '晚餐时间到，香喷喷的饭菜在等你', minAge: 3, maxAge: 10, slots: ['evening'] },
  { type: 'trim_nails', label: '剪指甲', icon: 'hand-sparkles', category: 'life', phrase: '指甲短短，干净又安全', minAge: 4, maxAge: 10, slots: ['evening'] },
  { type: 'sunbathe', label: '晒太阳', icon: 'sun', category: 'life', phrase: '太阳公公给你补钙钙', minAge: 3, maxAge: 10, slots: ['morning', 'noon'] },
  { type: 'ventilate', label: '开窗通风', icon: 'wind', category: 'life', phrase: '让新鲜空气进来做客', minAge: 3, maxAge: 10, slots: ['morning', 'afternoon'] },
  { type: 'pack_tomorrow', label: '准备明天', icon: 'calendar-check', category: 'life', phrase: '提前准备，明天不慌张', minAge: 6, maxAge: 10, slots: ['evening', 'night'] },
  // ===== 健康身体 =====
  { type: 'exercise', label: '运动一下', icon: 'person-running', category: 'health', phrase: '蹦蹦跳跳才能长高高', minAge: 3, maxAge: 10, slots: ['morning', 'afternoon'] },
  { type: 'stretch', label: '伸展拉筋', icon: 'person-walking', category: 'health', phrase: '伸伸懒腰，身体像小弹簧', minAge: 3, maxAge: 10, slots: ['morning', 'afternoon'] },
  { type: 'deep_breath', label: '深呼吸', icon: 'wind', category: 'health', phrase: '闻闻花香，吹吹蜡烛，慢慢呼吸', minAge: 3, maxAge: 10, slots: ['evening', 'night'] },
  { type: 'eye_rest', label: '休息眼睛', icon: 'eye-low-vision', category: 'health', phrase: '小眼睛也要休息一下下', minAge: 3, maxAge: 10, slots: ['afternoon', 'evening'] },
  { type: 'sit_straight', label: '坐姿端正', icon: 'chair', category: 'health', phrase: '小树一样挺拔才最帅气', minAge: 5, maxAge: 10, slots: ['afternoon', 'evening'] },
  { type: 'eat_fruit', label: '吃水果', icon: 'apple-whole', category: 'health', phrase: '维他命小能量兵来报到', minAge: 3, maxAge: 10, slots: ['morning', 'afternoon'] },
  { type: 'eat_vegetables', label: '吃蔬菜', icon: 'carrot', category: 'health', phrase: '蔬菜精灵让你变得更强壮', minAge: 3, maxAge: 10, slots: ['noon', 'evening'] },
  { type: 'drink_milk', label: '喝牛奶', icon: 'mug-hot', category: 'health', phrase: '牛奶白白，个子高高', minAge: 3, maxAge: 10, slots: ['morning', 'night'] },
  { type: 'no_snack', label: '少吃零食', icon: 'candy-cane', category: 'health', phrase: '零食小怪兽要少出来哦', minAge: 3, maxAge: 10, slots: ['afternoon', 'evening'] },
  { type: 'eye_look_far', label: '远眺护眼', icon: 'eye', category: 'health', phrase: '看看远方的绿树，眼睛谢谢你', minAge: 4, maxAge: 10, slots: ['afternoon', 'evening'] },
  { type: 'wash_fruit', label: '洗水果', icon: 'sink', category: 'health', phrase: '水果宝宝要先洗个澡', minAge: 3, maxAge: 10, slots: ['afternoon'] },
  { type: 'morning_gargle', label: '晨起漱口', icon: 'droplet', category: 'health', phrase: '咕噜咕噜，嘴巴干净啦', minAge: 3, maxAge: 10, slots: ['morning'] },
  { type: 'sun_protection', label: '出门戴帽', icon: 'umbrella', category: 'health', phrase: '小帽子保护你不被晒到', minAge: 3, maxAge: 10, slots: ['morning', 'noon'] },
  { type: 'warm_clothes', label: '天冷加衣', icon: 'temperature-low', category: 'health', phrase: '穿上小外套，冷风进不来', minAge: 3, maxAge: 10, slots: ['morning', 'evening'] },
  { type: 'take_medicine', label: '按时吃药', icon: 'pills', category: 'health', phrase: '药药虽然苦，但它是打败病菌的战士', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  // ===== 学习成长 =====
  { type: 'read_book', label: '读绘本', icon: 'book', category: 'study', phrase: '绘本里藏着好多好玩的故事', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'independent_read', label: '自主阅读', icon: 'book-open', category: 'study', phrase: '自己读书最安静最专注', minAge: 6, maxAge: 10, slots: ['evening', 'night'] },
  { type: 'write_chars', label: '练写字', icon: 'pencil', category: 'study', phrase: '一笔一画，写出漂亮的字', minAge: 5, maxAge: 10, slots: ['afternoon', 'evening'] },
  { type: 'learn_pinyin', label: '学拼音', icon: 'language', category: 'study', phrase: '拼音是汉字的好朋友', minAge: 5, maxAge: 8, slots: ['afternoon'] },
  { type: 'math_practice', label: '数学小游戏', icon: 'calculator', category: 'study', phrase: '数字宝宝和你玩捉迷藏', minAge: 5, maxAge: 10, slots: ['afternoon'] },
  { type: 'english_words', label: '学英语单词', icon: 'globe', category: 'study', phrase: '英语单词像糖果一样甜甜的', minAge: 3, maxAge: 10, slots: ['afternoon', 'evening'] },
  { type: 'recite_poem', label: '背古诗', icon: 'scroll', category: 'study', phrase: '古时候的诗句像唱歌一样好听', minAge: 5, maxAge: 10, slots: ['evening'] },
  { type: 'tell_story', label: '讲个故事', icon: 'hat-wizard', category: 'study', phrase: '把你的故事讲给我听好不好', minAge: 3, maxAge: 10, slots: ['evening', 'night'] },
  { type: 'draw_picture', label: '画画', icon: 'paintbrush', category: 'study', phrase: '画出你心里的彩色世界', minAge: 3, maxAge: 10, slots: ['afternoon'] },
  { type: 'preview_lesson', label: '预习明天的课', icon: 'chalkboard-user', category: 'study', phrase: '先看看明天的课，当个小侦探', minAge: 6, maxAge: 10, slots: ['evening'] },
  { type: 'review_lesson', label: '复习功课', icon: 'book-bookmark', category: 'study', phrase: '温故而知新，越学越聪明', minAge: 6, maxAge: 10, slots: ['evening'] },
  { type: 'homework', label: '做作业', icon: 'pen-to-square', category: 'study', phrase: '作业小怪兽等你来打败', minAge: 6, maxAge: 10, slots: ['afternoon', 'evening'] },
  { type: 'learn_music', label: '认识乐器', icon: 'music', category: 'study', phrase: '叮叮咚咚的音乐真美妙', minAge: 4, maxAge: 10, slots: ['afternoon'] },
  { type: 'count_numbers', label: '数数练习', icon: 'hashtag', category: 'study', phrase: '一起数一数，1、2、3', minAge: 3, maxAge: 6, slots: ['afternoon'] },
  { type: 'observe_nature', label: '观察大自然', icon: 'magnifying-glass', category: 'study', phrase: '叶子背后藏着什么秘密呢', minAge: 3, maxAge: 10, slots: ['afternoon'] },
  // ===== 情绪社交 =====
  { type: 'say_please', label: '礼貌用语', icon: 'hand', category: 'social', phrase: '请和谢谢是最神奇的魔法词', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'share_toys', label: '分享玩具', icon: 'gift', category: 'social', phrase: '好玩具和朋友一起玩更开心', minAge: 3, maxAge: 10, slots: ['afternoon'] },
  { type: 'help_chores', label: '帮做家务', icon: 'broom', category: 'social', phrase: '小小帮手，家里亮晶晶', minAge: 4, maxAge: 10, slots: ['evening'] },
  { type: 'family_hug', label: '抱抱家人', icon: 'heart', category: 'social', phrase: '一个大大的拥抱，暖到心里', minAge: 3, maxAge: 10, slots: ['evening', 'night'] },
  { type: 'talk_day', label: '分享今天的事', icon: 'comment', category: 'social', phrase: '今天有什么好玩的事讲给我听', minAge: 3, maxAge: 10, slots: ['evening', 'night'] },
  { type: 'gratitude', label: '感恩时刻', icon: 'bell', category: 'social', phrase: '说一说今天要谢谢谁', minAge: 4, maxAge: 10, slots: ['night'] },
  { type: 'apologize', label: '学会道歉', icon: 'comment-dots', category: 'social', phrase: '说声对不起，友谊更牢固', minAge: 4, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'make_friend', label: '交新朋友', icon: 'user-group', category: 'social', phrase: '新朋友就像新宝藏', minAge: 4, maxAge: 10, slots: ['afternoon'] },
  { type: 'patience_game', label: '等待练习', icon: 'hourglass-half', category: 'social', phrase: '小种子慢慢等，才能开花', minAge: 4, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'express_feelings', label: '说出感受', icon: 'face-smile-beam', category: 'social', phrase: '开心还是难过，说出来就好', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'calm_down', label: '安静一会儿', icon: 'leaf', category: 'social', phrase: '像小猫一样安静地待一会儿', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'screen_time', label: '约定屏幕时间', icon: 'mobile-screen', category: 'social', phrase: '和屏幕说再见，眼睛更明亮', minAge: 3, maxAge: 10, slots: ['afternoon', 'evening'] },
  { type: 'keep_promise', label: '遵守约定', icon: 'handshake', category: 'social', phrase: '说话算数才是好孩子', minAge: 4, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'praise_others', label: '夸夸别人', icon: 'thumbs-up', category: 'social', phrase: '发现别人的优点，夸夸他', minAge: 4, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'take_turns', label: '轮流玩', icon: 'arrows-left-right', category: 'social', phrase: '你一次我一次，轮流最公平', minAge: 3, maxAge: 8, slots: ['afternoon'] },
  // ===== 创意玩耍 =====
  { type: 'sing_song', label: '唱首歌', icon: 'microphone', category: 'play', phrase: '唱出你最喜欢的那首歌', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'dance', label: '跳跳舞', icon: 'music', category: 'play', phrase: '跟着音乐扭一扭', minAge: 3, maxAge: 10, slots: ['afternoon', 'evening'] },
  { type: 'build_blocks', label: '搭积木', icon: 'cubes', category: 'play', phrase: '看看你能搭出什么大城堡', minAge: 3, maxAge: 10, slots: ['afternoon'] },
  { type: 'play_puzzle', label: '玩拼图', icon: 'puzzle-piece', category: 'play', phrase: '拼图碎片找朋友', minAge: 4, maxAge: 10, slots: ['afternoon'] },
  { type: 'clay_play', label: '捏橡皮泥', icon: 'shapes', category: 'play', phrase: '捏个小动物送给我好不好', minAge: 3, maxAge: 10, slots: ['afternoon'] },
  { type: 'role_play', label: '角色扮演', icon: 'masks-theater', category: 'play', phrase: '今天你想扮演谁呀', minAge: 3, maxAge: 10, slots: ['afternoon'] },
  { type: 'paper_cut', label: '剪纸手工', icon: 'scissors', category: 'play', phrase: '小剪刀咔嚓咔嚓变魔术', minAge: 5, maxAge: 10, slots: ['afternoon'] },
  { type: 'origami', label: '折纸', icon: 'paper-plane', category: 'play', phrase: '一张纸折出小飞机', minAge: 4, maxAge: 10, slots: ['afternoon'] },
  { type: 'outdoor_play', label: '户外玩耍', icon: 'tree', category: 'play', phrase: '外面的世界好玩又新鲜', minAge: 3, maxAge: 10, slots: ['morning', 'afternoon'] },
  { type: 'ball_play', label: '玩球', icon: 'futbol', category: 'play', phrase: '把球球抛向天空', minAge: 3, maxAge: 10, slots: ['afternoon'] },
  { type: 'bike_riding', label: '骑自行车', icon: 'bicycle', category: 'play', phrase: '小轮子转呀转', minAge: 4, maxAge: 10, slots: ['afternoon'] },
  { type: 'nature_walk', label: '公园散步', icon: 'person-walking', category: 'play', phrase: '一起去发现春天的秘密', minAge: 3, maxAge: 10, slots: ['morning', 'afternoon'] },
  { type: 'hide_seek', label: '捉迷藏', icon: 'magnifying-glass', category: 'play', phrase: '数到十，我来找你啦', minAge: 3, maxAge: 10, slots: ['afternoon'] },
  { type: 'basketball', label: '拍皮球', icon: 'basketball', category: 'play', phrase: '皮球弹得高又高', minAge: 3, maxAge: 10, slots: ['afternoon'] },
  { type: 'camping_tent', label: '搭小帐篷', icon: 'campground', category: 'play', phrase: '搭一个属于你的小城堡', minAge: 4, maxAge: 10, slots: ['afternoon'] },
  // ===== 安全守护 =====
  { type: 'traffic_safety', label: '交通规则', icon: 'traffic-light', category: 'safety', phrase: '红灯停，绿灯行', minAge: 3, maxAge: 10, slots: ['morning', 'afternoon'] },
  { type: 'stranger_awareness', label: '陌生人警惕', icon: 'user-shield', category: 'safety', phrase: '不认识的人给的东西不能要', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'electric_safety', label: '用电安全', icon: 'plug', category: 'safety', phrase: '小手指不能伸进插座里', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'fire_safety', label: '防火小知识', icon: 'fire-extinguisher', category: 'safety', phrase: '火苗很危险，要离它远远的', minAge: 4, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'water_safety', label: '防溺水', icon: 'person-swimming', category: 'safety', phrase: '没有大人陪，不能去玩水', minAge: 3, maxAge: 10, slots: ['afternoon'] },
  { type: 'hot_safety', label: '烫的东西慢点碰', icon: 'temperature-high', category: 'safety', phrase: '热汤热茶，吹一吹再碰', minAge: 3, maxAge: 10, slots: ['noon', 'evening'] },
  { type: 'lost_plan', label: '走丢了怎么办', icon: 'map-location-dot', category: 'safety', phrase: '站在原地等爸爸妈妈', minAge: 4, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'emergency_call', label: '记住求助电话', icon: 'phone', category: 'safety', phrase: '110、119、120是超级英雄电话', minAge: 5, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'body_privacy', label: '身体小主人', icon: 'shield', category: 'safety', phrase: '你的身体你做主', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'helmet_wear', label: '骑车戴头盔', icon: 'helmet-safety', category: 'safety', phrase: '小头盔保护大头', minAge: 3, maxAge: 10, slots: ['afternoon'] },
  // ===== 赞美鼓励 =====
  { type: 'praise_day', label: '今天真棒', icon: 'thumbs-up', category: 'praise', phrase: '请夸夸我今天的表现，先问问我今天做了什么，再具体地夸夸我', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'strength_finder', label: '优点大发现', icon: 'medal', category: 'praise', phrase: '请帮我发现我的优点，像挖宝藏一样夸夸我', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'effort_praise', label: '夸夸努力', icon: 'star', category: 'praise', phrase: '请夸夸我今天特别努力的事情', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'brave_moment', label: '勇敢时刻', icon: 'bolt', category: 'praise', phrase: '请问问我今天做过什么勇敢的事，然后夸夸我', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'progress_star', label: '进步之星', icon: 'chart-line', category: 'praise', phrase: '请夸夸我今天比昨天进步的地方', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'kindness_praise', label: '善良之星', icon: 'hand-holding-heart', category: 'praise', phrase: '请问问我今天帮助过谁，夸夸我的善良', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'try_again', label: '再试一次', icon: 'arrow-rotate-right', category: 'praise', phrase: '我有点想放弃了，请鼓励我再试一次', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'thank_you', label: '学说谢谢', icon: 'hands-praying', category: 'praise', phrase: '请提醒我，别忘了对帮助你的人说谢谢', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'self_intro', label: '自我介绍', icon: 'address-card', category: 'praise', phrase: '请陪我练习自我介绍，然后夸夸我', minAge: 4, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
  { type: 'dream_talk', label: '说说梦想', icon: 'rocket', category: 'praise', phrase: '请问问我长大想做什么，夸夸我的梦想', minAge: 3, maxAge: 10, slots: ['morning', 'noon', 'afternoon', 'evening', 'night'] },
];

// 卡片调色板（循环使用）
const PALETTE = [
  { color: '#7C5CFC', bg: '#EFEBFF', shadow: '#7C5CFC' },
  { color: '#FF7043', bg: '#FFF0EC', shadow: '#FF7043' },
  { color: '#26A69A', bg: '#E6F5F3', shadow: '#26A69A' },
  { color: '#FFA726', bg: '#FFF3E0', shadow: '#FFA726' },
  { color: '#EC6B9D', bg: '#FDEEF4', shadow: '#EC6B9D' },
  { color: '#42A5F5', bg: '#E9F4FE', shadow: '#42A5F5' },
  { color: '#9CCC65', bg: '#F1F7E8', shadow: '#9CCC65' },
  { color: '#FFB300', bg: '#FFF7E0', shadow: '#FFB300' },
];

/**
 * 服务端文件：server/src/routes/tasks.ts
 * 接口：GET /api/v1/tasks/library
 * Query 参数：search?: string（按 label/type 过滤），category?: CategoryKey（按分类过滤）
 * 返回：分类列表 + 任务库（含完整指令话术 command、卡片配色）
 */
router.get('/library', (req, res) => {
  const search = String(req.query.search ?? '').trim().toLowerCase();
  const category = String(req.query.category ?? '').trim();

  let tasks = TASK_LIBRARY;
  if (category && cat_map_check(category)) {
    tasks = tasks.filter((t) => t.category === category);
  }
  if (search) {
    tasks = tasks.filter(
      (t) => t.label.toLowerCase().includes(search) || t.type.toLowerCase().includes(search),
    );
  }

  const withStyle = tasks.map((t, i) => {
    const p = PALETTE[i % PALETTE.length];
    const isPraise = t.category === 'praise';
    return {
      ...t,
      color: p.color,
      bg: p.bg,
      shadow: p.shadow,
      command: isPraise ? t.phrase : `请提醒我去${t.label}`,
      reason: t.phrase,
    };
  });

  res.json({
    categories: TASK_CATEGORIES,
    tasks: withStyle,
    total: TASK_LIBRARY.length,
  });
});

function cat_map_check(c: string): boolean {
  return TASK_CATEGORIES.some((x) => x.key === c);
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

  const tasks = shuffle(pool).slice(0, 2).map((t) => ({
    ...t,
    command: t.category === 'praise' ? t.reason : `请提醒我去${t.label}`,
  }));

  res.json({
    timeSlot,
    slotGreeting: SLOT_LABELS[timeSlot],
    tasks,
  });
});

export default router;
