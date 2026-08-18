import { Router, type Request, type Response } from 'express';

const router = Router();

// English card data for kids (ages 3-10)
const CARD_DATA: Record<string, Array<{ id: string; en: string; zh: string; emoji: string }>> = {
  animals: [
    { id: 'a1', en: 'Cat', zh: '猫', emoji: '🐱' },
    { id: 'a2', en: 'Dog', zh: '狗', emoji: '🐶' },
    { id: 'a3', en: 'Bird', zh: '鸟', emoji: '🐦' },
    { id: 'a4', en: 'Fish', zh: '鱼', emoji: '🐟' },
    { id: 'a5', en: 'Rabbit', zh: '兔子', emoji: '🐰' },
    { id: 'a6', en: 'Bear', zh: '熊', emoji: '' },
    { id: 'a7', en: 'Duck', zh: '鸭子', emoji: '🦆' },
    { id: 'a8', en: 'Horse', zh: '马', emoji: '' },
    { id: 'a9', en: 'Cow', zh: '牛', emoji: '🐮' },
    { id: 'a10', en: 'Pig', zh: '猪', emoji: '🐷' },
    { id: 'a11', en: 'Sheep', zh: '羊', emoji: '🐑' },
    { id: 'a12', en: 'Monkey', zh: '猴子', emoji: '🐵' },
  ],
  fruits: [
    { id: 'f1', en: 'Apple', zh: '苹果', emoji: '🍎' },
    { id: 'f2', en: 'Banana', zh: '香蕉', emoji: '🍌' },
    { id: 'f3', en: 'Orange', zh: '橙子', emoji: '🍊' },
    { id: 'f4', en: 'Grape', zh: '葡萄', emoji: '🍇' },
    { id: 'f5', en: 'Strawberry', zh: '草莓', emoji: '🍓' },
    { id: 'f6', en: 'Watermelon', zh: '西瓜', emoji: '🍉' },
    { id: 'f7', en: 'Peach', zh: '桃子', emoji: '🍑' },
    { id: 'f8', en: 'Pear', zh: '梨', emoji: '🍐' },
    { id: 'f9', en: 'Cherry', zh: '樱桃', emoji: '🍒' },
    { id: 'f10', en: 'Lemon', zh: '柠檬', emoji: '' },
    { id: 'f11', en: 'Mango', zh: '芒果', emoji: '🥭' },
    { id: 'f12', en: 'Pineapple', zh: '菠萝', emoji: '🍍' },
  ],
  foods: [
    { id: 'd1', en: 'Rice', zh: '米饭', emoji: '' },
    { id: 'd2', en: 'Bread', zh: '面包', emoji: '🍞' },
    { id: 'd3', en: 'Egg', zh: '鸡蛋', emoji: '🥚' },
    { id: 'd4', en: 'Milk', zh: '牛奶', emoji: '' },
    { id: 'd5', en: 'Cheese', zh: '奶酪', emoji: '🧀' },
    { id: 'd6', en: 'Cake', zh: '蛋糕', emoji: '🎂' },
    { id: 'd7', en: 'Cookie', zh: '饼干', emoji: '🍪' },
    { id: 'd8', en: 'Pizza', zh: '披萨', emoji: '🍕' },
    { id: 'd9', en: 'Hamburger', zh: '汉堡', emoji: '🍔' },
    { id: 'd10', en: 'Noodle', zh: '面条', emoji: '' },
    { id: 'd11', en: 'Soup', zh: '汤', emoji: '🍲' },
    { id: 'd12', en: 'Salad', zh: '沙拉', emoji: '' },
  ],
};

const THEMES = [
  { key: 'animals', label: '动物', emoji: '🐾', color: '#FFF3E0' },
  { key: 'fruits', label: '水果', emoji: '🍎', color: '#E8F5E9' },
  { key: 'foods', label: '食物', emoji: '', color: '#FFF8E1' },
];

/**
 * GET /api/v1/english/themes
 * Get available English learning themes
 */
router.get('/themes', (_req: Request, res: Response) => {
  res.json(THEMES);
});

/**
 * GET /api/v1/english/cards?theme=animals&count=8
 * Get random cards for a theme
 * Query: theme: 'animals' | 'fruits' | 'foods', count?: number (default 8, max 12)
 */
router.get('/cards', (req: Request, res: Response) => {
  const { theme, count } = req.query;
  const themeKey = theme as string;
  const cardCount = Math.min(Math.max(parseInt(count as string) || 8, 4), 12);

  if (!themeKey || !CARD_DATA[themeKey]) {
    res.status(400).json({ error: 'Invalid theme. Use: animals, fruits, foods' });
    return;
  }

  const cards = CARD_DATA[themeKey];
  // Shuffle and pick random cards
  const shuffled = [...cards].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(cardCount, cards.length));

  res.json({ theme: themeKey, cards: selected });
});

export default router;
