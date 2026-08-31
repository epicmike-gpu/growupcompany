import { Router, type Request, type Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = Router();

/**
 * Middleware: verify auth token
 */
async function authMiddleware(req: Request, res: Response, next: Function) {
  const token = req.headers['x-session'] as string;
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const supabase = getSupabaseClient(token);
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    (req as any).user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Auth failed' });
  }
}

// ==================== 词汇库（200+ 词，按年龄段分类） ====================

interface VocabWord {
  en: string;
  cn: string;
  emoji: string;
  category: string;
}

const VOCABULARY: Record<string, Record<string, VocabWord[]>> = {
  '3-5': {
    animals: [
        { en: 'dog', cn: '狗', emoji: '🐶', category: 'animals' },
        { en: 'cat', cn: '猫', emoji: '🐱', category: 'animals' },
        { en: 'rabbit', cn: '兔子', emoji: '🐰', category: 'animals' },
        { en: 'mouse', cn: '老鼠', emoji: '🐭', category: 'animals' },
        { en: 'bear', cn: '熊', emoji: '🐻', category: 'animals' },
        { en: 'panda', cn: '熊猫', emoji: '🐼', category: 'animals' },
        { en: 'koala', cn: '考拉', emoji: '🐨', category: 'animals' },
        { en: 'tiger', cn: '老虎', emoji: '🐯', category: 'animals' },
        { en: 'cow', cn: '奶牛', emoji: '🐮', category: 'animals' },
        { en: 'pig', cn: '猪', emoji: '🐷', category: 'animals' },
        { en: 'monkey', cn: '猴子', emoji: '🐵', category: 'animals' },
        { en: 'chicken', cn: '小鸡', emoji: '🐔', category: 'animals' },
        { en: 'penguin', cn: '企鹅', emoji: '🐧', category: 'animals' },
        { en: 'bird', cn: '鸟', emoji: '🐦', category: 'animals' },
        { en: 'chick', cn: '雏鸟', emoji: '🐤', category: 'animals' },
        { en: 'horse', cn: '马', emoji: '🐴', category: 'animals' },
        { en: 'sheep', cn: '绵羊', emoji: '🐑', category: 'animals' },
        { en: 'frog', cn: '青蛙', emoji: '🐸', category: 'animals' },
        { en: 'turtle', cn: '乌龟', emoji: '🐢', category: 'animals' },
        { en: 'elephant', cn: '大象', emoji: '🐘', category: 'animals' },
        { en: 'lion', cn: '狮子', emoji: '🦁', category: 'animals' },
        { en: 'bee', cn: '蜜蜂', emoji: '🐝', category: 'animals' },
        { en: 'fish', cn: '鱼', emoji: '🐟', category: 'animals' },
        { en: 'butterfly', cn: '蝴蝶', emoji: '🦋', category: 'animals' },
    ],
    fruits: [
        { en: 'apple', cn: '苹果', emoji: '🍎', category: 'fruits' },
        { en: 'banana', cn: '香蕉', emoji: '🍌', category: 'fruits' },
        { en: 'orange', cn: '橙子', emoji: '🍊', category: 'fruits' },
        { en: 'grape', cn: '葡萄', emoji: '🍇', category: 'fruits' },
        { en: 'watermelon', cn: '西瓜', emoji: '🍉', category: 'fruits' },
        { en: 'strawberry', cn: '草莓', emoji: '🍓', category: 'fruits' },
        { en: 'cherry', cn: '樱桃', emoji: '🍒', category: 'fruits' },
        { en: 'peach', cn: '桃子', emoji: '🍑', category: 'fruits' },
        { en: 'pear', cn: '梨', emoji: '🍐', category: 'fruits' },
        { en: 'lemon', cn: '柠檬', emoji: '🍋', category: 'fruits' },
        { en: 'pineapple', cn: '菠萝', emoji: '🍍', category: 'fruits' },
        { en: 'tomato', cn: '番茄', emoji: '🍅', category: 'fruits' },
        { en: 'corn', cn: '玉米', emoji: '🌽', category: 'fruits' },
        { en: 'carrot', cn: '胡萝卜', emoji: '🥕', category: 'fruits' },
        { en: 'eggplant', cn: '茄子', emoji: '🍆', category: 'fruits' },
        { en: 'potato', cn: '土豆', emoji: '🥔', category: 'fruits' },
        { en: 'pumpkin', cn: '南瓜', emoji: '🎃', category: 'fruits' },
    ],
    food: [
        { en: 'hamburger', cn: '汉堡', emoji: '🍔', category: 'food' },
        { en: 'french_fries', cn: '薯条', emoji: '🍟', category: 'food' },
        { en: 'pizza', cn: '披萨', emoji: '🍕', category: 'food' },
        { en: 'hotdog', cn: '热狗', emoji: '🌭', category: 'food' },
        { en: 'rice', cn: '米饭', emoji: '🍚', category: 'food' },
        { en: 'noodles', cn: '面条', emoji: '🍜', category: 'food' },
        { en: 'sushi', cn: '寿司', emoji: '🍣', category: 'food' },
        { en: 'ice_cream', cn: '冰淇淋', emoji: '🍦', category: 'food' },
        { en: 'cake', cn: '蛋糕', emoji: '🍰', category: 'food' },
        { en: 'chocolate', cn: '巧克力', emoji: '🍫', category: 'food' },
        { en: 'candy', cn: '糖果', emoji: '🍬', category: 'food' },
        { en: 'lollipop', cn: '棒棒糖', emoji: '🍭', category: 'food' },
        { en: 'cookie', cn: '饼干', emoji: '🍪', category: 'food' },
        { en: 'donut', cn: '甜甜圈', emoji: '🍩', category: 'food' },
        { en: 'milk', cn: '牛奶', emoji: '🥛', category: 'food' },
        { en: 'egg', cn: '鸡蛋', emoji: '🥚', category: 'food' },
        { en: 'bread', cn: '面包', emoji: '🍞', category: 'food' },
    ],
  },
  '6-8': {
    animals: [
        { en: 'snake', cn: '蛇', emoji: '🐍', category: 'animals' },
        { en: 'octopus', cn: '章鱼', emoji: '🐙', category: 'animals' },
        { en: 'crab', cn: '螃蟹', emoji: '🦀', category: 'animals' },
        { en: 'dolphin', cn: '海豚', emoji: '🐬', category: 'animals' },
        { en: 'whale', cn: '鲸鱼', emoji: '🐳', category: 'animals' },
        { en: 'shark', cn: '鲨鱼', emoji: '🦈', category: 'animals' },
        { en: 'crocodile', cn: '鳄鱼', emoji: '🐊', category: 'animals' },
        { en: 'unicorn', cn: '独角兽', emoji: '🦄', category: 'animals' },
        { en: 'eagle', cn: '老鹰', emoji: '🦅', category: 'animals' },
        { en: 'owl', cn: '猫头鹰', emoji: '🦉', category: 'animals' },
        { en: 'bat', cn: '蝙蝠', emoji: '🦇', category: 'animals' },
        { en: 'ladybug', cn: '瓢虫', emoji: '🐞', category: 'animals' },
        { en: 'snail', cn: '蜗牛', emoji: '🐌', category: 'animals' },
        { en: 'lizard', cn: '蜥蜴', emoji: '🦎', category: 'animals' },
        { en: 'rhino', cn: '犀牛', emoji: '🦏', category: 'animals' },
        { en: 'camel', cn: '骆驼', emoji: '🐪', category: 'animals' },
        { en: 'hippo', cn: '河马', emoji: '🦛', category: 'animals' },
        { en: 'leopard', cn: '豹子', emoji: '🐆', category: 'animals' },
        { en: 'deer', cn: '鹿', emoji: '🦌', category: 'animals' },
        { en: 'duck', cn: '鸭子', emoji: '🦆', category: 'animals' },
    ],
    fruits: [
        { en: 'melon', cn: '甜瓜', emoji: '🍈', category: 'fruits' },
        { en: 'kiwi', cn: '奇异果', emoji: '🥝', category: 'fruits' },
        { en: 'mango', cn: '芒果', emoji: '🥭', category: 'fruits' },
        { en: 'avocado', cn: '牛油果', emoji: '🥑', category: 'fruits' },
        { en: 'pepper', cn: '辣椒', emoji: '🌶️', category: 'fruits' },
        { en: 'broccoli', cn: '西兰花', emoji: '🥦', category: 'fruits' },
        { en: 'cucumber', cn: '黄瓜', emoji: '🥒', category: 'fruits' },
        { en: 'mushroom', cn: '蘑菇', emoji: '🍄', category: 'fruits' },
        { en: 'peanut', cn: '花生', emoji: '🥜', category: 'fruits' },
        { en: 'chestnut', cn: '板栗', emoji: '🌰', category: 'fruits' },
        { en: 'sweet_potato', cn: '红薯', emoji: '🍠', category: 'fruits' },
        { en: 'coconut', cn: '椰子', emoji: '🥥', category: 'fruits' },
    ],
    food: [
        { en: 'sandwich', cn: '三明治', emoji: '🥪', category: 'food' },
        { en: 'taco', cn: '墨西哥卷饼', emoji: '🌮', category: 'food' },
        { en: 'burrito', cn: '卷饼', emoji: '🌯', category: 'food' },
        { en: 'curry', cn: '咖喱', emoji: '🍛', category: 'food' },
        { en: 'fried_shrimp', cn: '炸虾', emoji: '🍤', category: 'food' },
        { en: 'pancake', cn: '煎饼', emoji: '🥞', category: 'food' },
        { en: 'bacon', cn: '培根', emoji: '🥓', category: 'food' },
        { en: 'salad', cn: '沙拉', emoji: '🥗', category: 'food' },
        { en: 'croissant', cn: '牛角包', emoji: '🥐', category: 'food' },
        { en: 'dumpling', cn: '饺子', emoji: '🥟', category: 'food' },
        { en: 'cheese', cn: '奶酪', emoji: '🧀', category: 'food' },
        { en: 'pie', cn: '派', emoji: '🥧', category: 'food' },
        { en: 'honey', cn: '蜂蜜', emoji: '🍯', category: 'food' },
        { en: 'pasta', cn: '意面', emoji: '🍝', category: 'food' },
        { en: 'popcorn', cn: '爆米花', emoji: '🍿', category: 'food' },
        { en: 'steak', cn: '牛排', emoji: '🥩', category: 'food' },
        { en: 'soup', cn: '汤', emoji: '🥣', category: 'food' },
        { en: 'toast', cn: '吐司', emoji: '🍞', category: 'food' },
    ],
  },
  '8-10': {
    animals: [
        { en: 'scorpion', cn: '蝎子', emoji: '🦂', category: 'animals' },
        { en: 'shrimp', cn: '虾', emoji: '🦐', category: 'animals' },
        { en: 'squid', cn: '鱿鱼', emoji: '🦑', category: 'animals' },
        { en: 'peacock', cn: '孔雀', emoji: '🦚', category: 'animals' },
        { en: 'parrot', cn: '鹦鹉', emoji: '🦜', category: 'animals' },
        { en: 'gorilla', cn: '大猩猩', emoji: '🦍', category: 'animals' },
        { en: 'buffalo', cn: '水牛', emoji: '🐃', category: 'animals' },
        { en: 'turkey', cn: '火鸡', emoji: '🦃', category: 'animals' },
        { en: 'boar', cn: '野猪', emoji: '🐗', category: 'animals' },
        { en: 'raccoon', cn: '浣熊', emoji: '🦝', category: 'animals' },
        { en: 'badger', cn: '獾', emoji: '🦡', category: 'animals' },
        { en: 'ox', cn: '公牛', emoji: '🐂', category: 'animals' },
        { en: 'swan', cn: '天鹅', emoji: '🦢', category: 'animals' },
        { en: 'dove', cn: '鸽子', emoji: '🕊️', category: 'animals' },
        { en: 'hare', cn: '野兔', emoji: '🐇', category: 'animals' },
        { en: 'goat', cn: '山羊', emoji: '🐐', category: 'animals' },
    ],
    fruits: [
        { en: 'raspberry', cn: '树莓', emoji: '🍓', category: 'fruits' },
        { en: 'blackberry', cn: '黑莓', emoji: '🍇', category: 'fruits' },
        { en: 'lychee', cn: '荔枝', emoji: '🍒', category: 'fruits' },
        { en: 'nectarine', cn: '油桃', emoji: '🍑', category: 'fruits' },
        { en: 'guava', cn: '番石榴', emoji: '🍐', category: 'fruits' },
        { en: 'grapefruit', cn: '西柚', emoji: '🍊', category: 'fruits' },
    ],
    food: [
        { en: 'lasagna', cn: '千层面', emoji: '🍝', category: 'food' },
        { en: 'ramen', cn: '拉面', emoji: '🍜', category: 'food' },
        { en: 'macaron', cn: '马卡龙', emoji: '🍪', category: 'food' },
        { en: 'eclair', cn: '闪电泡芙', emoji: '🍩', category: 'food' },
        { en: 'sausage', cn: '香肠', emoji: '🌭', category: 'food' },
        { en: 'risotto', cn: '烩饭', emoji: '🍚', category: 'food' },
        { en: 'yogurt', cn: '酸奶', emoji: '🥛', category: 'food' },
        { en: 'dim_sum', cn: '点心', emoji: '🥟', category: 'food' },
        { en: 'guacamole', cn: '牛油果酱', emoji: '🥑', category: 'food' },
        { en: 'juice', cn: '果汁', emoji: '🥤', category: 'food' },
        { en: 'biscuit', cn: '苏打饼干', emoji: '🥠', category: 'food' },
        { en: 'jam', cn: '果酱', emoji: '🍯', category: 'food' },
    ],
  },
};

// ==================== 关卡配置 ====================

interface LevelConfig {
  level: number;
  pairCount: number;
  timeLimit: number; // 秒，0 表示不限时
  name: string;
}

const LEVEL_CONFIGS: Record<string, LevelConfig[]> = {
  '3-5': [
    { level: 1, pairCount: 3, timeLimit: 0, name: '入门' },
    { level: 2, pairCount: 4, timeLimit: 0, name: '简单' },
    { level: 3, pairCount: 5, timeLimit: 0, name: '普通' },
    { level: 4, pairCount: 6, timeLimit: 0, name: '进阶' },
    { level: 5, pairCount: 6, timeLimit: 60, name: '挑战' },
  ],
  '6-8': [
    { level: 1, pairCount: 4, timeLimit: 0, name: '入门' },
    { level: 2, pairCount: 5, timeLimit: 0, name: '简单' },
    { level: 3, pairCount: 6, timeLimit: 0, name: '普通' },
    { level: 4, pairCount: 6, timeLimit: 45, name: '进阶' },
    { level: 5, pairCount: 8, timeLimit: 60, name: '挑战' },
  ],
  '8-10': [
    { level: 1, pairCount: 4, timeLimit: 30, name: '入门' },
    { level: 2, pairCount: 5, timeLimit: 45, name: '简单' },
    { level: 3, pairCount: 6, timeLimit: 45, name: '普通' },
    { level: 4, pairCount: 6, timeLimit: 30, name: '进阶' },
    { level: 5, pairCount: 8, timeLimit: 45, name: '挑战' },
  ],
};

// ==================== API 接口 ====================

// 获取年龄段列表
router.get('/age-groups', (_req, res) => {
  res.json({
    data: [
      { key: '3-5', label: '3-5 岁', description: '基础认知，简单词汇' },
      { key: '6-8', label: '6-8 岁', description: '日常拓展，更多词汇' },
      { key: '8-10', label: '8-10 岁', description: '进阶学习，挑战模式' },
    ],
  });
});

// 获取主题列表
router.get('/themes', (req, res) => {
  const ageGroup = (req.query.age as string) || '3-5';
  const themes = VOCABULARY[ageGroup] || VOCABULARY['3-5'];

  const themeInfo: Record<string, { label: string; icon: string; color: string; count: number }> = {
    animals: { label: '动物', icon: 'paw', color: '#FF8FAB', count: themes.animals?.length || 0 },
    fruits: { label: '水果', icon: 'apple-whole', color: '#FF7043', count: themes.fruits?.length || 0 },
    food: { label: '食物', icon: 'utensils', color: '#5ED6A0', count: themes.food?.length || 0 },
  };

  res.json({ data: themeInfo });
});

// 获取关卡配置
router.get('/levels', (req, res) => {
  const ageGroup = (req.query.age as string) || '3-5';
  res.json({ data: LEVEL_CONFIGS[ageGroup] || LEVEL_CONFIGS['3-5'] });
});

// 获取卡片（根据年龄段、主题、关卡）
router.get('/cards', (req, res) => {
  const ageGroup = (req.query.age as string) || '3-5';
  const theme = (req.query.theme as string) || 'animals';
  const level = parseInt(req.query.level as string) || 1;

  const themes = VOCABULARY[ageGroup] || VOCABULARY['3-5'];
  const words = themes[theme] || themes.animals || [];
  const levelConfig = (LEVEL_CONFIGS[ageGroup] || LEVEL_CONFIGS['3-5'])[level - 1] || LEVEL_CONFIGS['3-5'][0];

  const pairCount = levelConfig.pairCount;

  // 随机抽取
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(pairCount, shuffled.length));

  // 生成配对卡片
  const cards: Array<{
    id: string;
    pairId: string;
    text: string;
    emoji: string;
    type: 'en' | 'cn';
  }> = [];

  selected.forEach((word, index) => {
    const pairId = `pair_${index}`;
    cards.push({
      id: `${pairId}_en`,
      pairId,
      text: word.en.replace(/_/g, ' '),
      emoji: word.emoji,
      type: 'en',
    });
    cards.push({
      id: `${pairId}_cn`,
      pairId,
      text: word.cn,
      emoji: word.emoji,
      type: 'cn',
    });
  });

  // 打乱顺序
  const shuffledCards = cards.sort(() => Math.random() - 0.5);

  res.json({
    data: {
      cards: shuffledCards,
      levelConfig,
      totalPairs: selected.length,
    },
  });
});

// 保存游戏成绩
router.post('/score', authMiddleware, async (req: Request, res: Response) => {
  const { age_group, theme, level, attempts, time_used, perfect } = req.body;

  try {
    const token = req.headers['x-session'] as string;
    const supabase = getSupabaseClient(token);
    const user = (req as any).user;

    await supabase.from('game_scores').insert({
      user_id: user.id,
      age_group,
      theme,
      level,
      attempts,
      time_used,
      perfect: perfect || false,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Save score error:', error);
    res.status(500).json({ error: 'Failed to save score' });
  }
});

export default router;
