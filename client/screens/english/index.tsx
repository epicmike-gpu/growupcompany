import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

const API_BASE = `${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/english`;

interface CardData {
  id: string;
  pairId: string;
  text: string;
  emoji: string;
  type: 'en' | 'cn';
}

interface LevelConfig {
  level: number;
  pairCount: number;
  timeLimit: number;
  name: string;
}

interface ThemeInfo {
  label: string;
  icon: string;
  color: string;
  count: number;
}

type Screen = 'age' | 'theme' | 'level' | 'game' | 'result';

export default function EnglishScreen() {
  const router = useSafeRouter();
  const [screen, setScreen] = useState<Screen>('age');
  const [ageGroup, setAgeGroup] = useState('3-5');
  const [theme, setTheme] = useState('animals');
  const [level, setLevel] = useState(1);
  const [themes, setThemes] = useState<Record<string, ThemeInfo>>({});
  const [levels, setLevels] = useState<LevelConfig[]>([]);
  const [cards, setCards] = useState<CardData[]>([]);
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [attempts, setAttempts] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [levelConfig, setLevelConfig] = useState<LevelConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { width: windowWidth } = useWindowDimensions();

  // 年龄组
  const ageGroups = [
    { key: '3-5', label: '3-5 岁', desc: '基础认知', color: '#FF8FAB', icon: 'baby' },
    { key: '6-8', label: '6-8 岁', desc: '日常拓展', color: '#4FC3F7', icon: 'child' },
    { key: '8-10', label: '8-10 岁', desc: '进阶学习', color: '#AB47BC', icon: 'graduation-cap' },
  ];

  // 获取主题
  const fetchThemes = useCallback(async (age: string) => {
    try {
      const res = await fetch(`${API_BASE}/themes?age=${age}`);
      const data = await res.json();
      setThemes(data.data || {});
    } catch (error) {
      console.error('Fetch themes error:', error);
    }
  }, []);

  // 获取关卡
  const fetchLevels = useCallback(async (age: string) => {
    try {
      const res = await fetch(`${API_BASE}/levels?age=${age}`);
      const data = await res.json();
      setLevels(data.data || []);
    } catch (error) {
      console.error('Fetch levels error:', error);
    }
  }, []);

  // 开始游戏
  const startGame = useCallback(async (lvl: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/cards?age=${ageGroup}&theme=${theme}&level=${lvl}`);
      const data = await res.json();
      setCards(data.data.cards || []);
      setLevelConfig(data.data.levelConfig);
      setFlipped([]);
      setMatched(new Set());
      setAttempts(0);
      setTimeLeft(data.data.levelConfig.timeLimit || 0);
      setScreen('game');
    } catch (error) {
      console.error('Start game error:', error);
      Alert.alert('错误', '加载游戏失败');
    } finally {
      setLoading(false);
    }
  }, [ageGroup, theme]);

  // 计时器
  useEffect(() => {
    if (screen === 'game' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setScreen('result');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [screen, timeLeft > 0]);

  // 检查配对
  useEffect(() => {
    if (flipped.length === 2) {
      setAttempts((prev) => prev + 1);
      const [first, second] = flipped;
      const card1 = cards.find((c) => c.id === first);
      const card2 = cards.find((c) => c.id === second);

      if (card1 && card2 && card1.pairId === card2.pairId) {
        // 配对成功（pairId 加入 Set 会自动去重，size = 已配对数）
        setTimeout(() => {
          setMatched((prev) => {
            const newSet = new Set(prev);
            newSet.add(card1.pairId);
            // 检查是否完成：已配对数 === 总对数（cards.length / 2）
            if (newSet.size === cards.length / 2) {
              if (timerRef.current) clearInterval(timerRef.current);
              setTimeout(() => setScreen('result'), 600);
            }
            return newSet;
          });
          setFlipped([]);
        }, 500);
      } else {
        // 配对失败
        setTimeout(() => {
          setFlipped([]);
        }, 800);
      }
    }
  }, [flipped, cards]);

  // 翻牌
  const handleFlip = (cardId: string) => {
    if (flipped.length >= 2) return;
    if (flipped.includes(cardId)) return;
    if (matched.has(cardId)) return;
    setFlipped((prev) => [...prev, cardId]);
  };

  // 渲染年龄选择
  const renderAgeSelection = () => (
    <View style={styles.content}>
      <Text style={styles.title}>选择年龄段</Text>
      <Text style={styles.subtitle}>选择适合小朋友的年龄范围</Text>
      <View style={styles.ageList}>
        {ageGroups.map((age) => (
          <TouchableOpacity
            key={age.key}
            style={[styles.ageCard, { backgroundColor: age.color + '20', borderColor: age.color }]}
            onPress={() => {
              setAgeGroup(age.key);
              fetchThemes(age.key);
              fetchLevels(age.key);
              setScreen('theme');
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.ageIcon, { backgroundColor: age.color }]}>
              <FontAwesome6 name={age.icon} size={32} color="#FFFFFF" />
            </View>
            <Text style={[styles.ageLabel, { color: age.color }]}>{age.label}</Text>
            <Text style={styles.ageDesc}>{age.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // 渲染主题选择
  const renderThemeSelection = () => (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('age')}>
          <FontAwesome6 name="arrow-left" size={20} color="#7C5CFC" />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>选择主题</Text>
          <Text style={styles.subtitle}>{ageGroups.find((a) => a.key === ageGroup)?.label}</Text>
        </View>
      </View>
      <View style={styles.themeList}>
        {Object.entries(themes).map(([key, info]) => (
          <TouchableOpacity
            key={key}
            style={[styles.themeCard, { backgroundColor: info.color + '20', borderColor: info.color }]}
            onPress={() => {
              setTheme(key);
              setScreen('level');
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.themeIcon, { backgroundColor: info.color }]}>
              <FontAwesome6 name={info.icon} size={28} color="#FFFFFF" />
            </View>
            <Text style={[styles.themeLabel, { color: info.color }]}>{info.label}</Text>
            <Text style={styles.themeCount}>{info.count} 个单词</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // 渲染关卡选择
  const renderLevelSelection = () => (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('theme')}>
          <FontAwesome6 name="arrow-left" size={20} color="#7C5CFC" />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>选择关卡</Text>
          <Text style={styles.subtitle}>{themes[theme]?.label}主题</Text>
        </View>
      </View>
      <View style={styles.levelList}>
        {levels.map((lvl) => (
          <TouchableOpacity
            key={lvl.level}
            style={styles.levelCard}
            onPress={() => startGame(lvl.level)}
            activeOpacity={0.8}
          >
            <View style={styles.levelHeader}>
              <Text style={styles.levelNum}>第 {lvl.level} 关</Text>
              <Text style={styles.levelName}>{lvl.name}</Text>
            </View>
            <View style={styles.levelInfo}>
              <Text style={styles.levelDetail}>{lvl.pairCount} 对卡片</Text>
              {lvl.timeLimit > 0 && <Text style={styles.levelDetail}>{lvl.timeLimit} 秒限时</Text>}
              {lvl.timeLimit === 0 && <Text style={styles.levelDetail}>不限时</Text>}
            </View>
            <FontAwesome6 name="chevron-right" size={16} color="#8B87A0" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // 渲染游戏
  const renderGame = () => {
    const cols = 4;
    // 卡宽随屏幕宽度自适应：预留左右 padding 32 + 卡间距 gap 3×12
    const cardWidth = Math.floor((windowWidth - 32 - (cols - 1) * 12) / cols);
    const totalPairs = Math.max(cards.length / 2, 1);

    return (
      <View style={styles.gameContent}>
        <View style={styles.gameHeader}>
          <TouchableOpacity style={styles.gameCloseBtn} onPress={() => setScreen('level')}>
            <FontAwesome6 name="xmark" size={22} color="#7C5CFC" />
          </TouchableOpacity>
          <View style={styles.gameInfo}>
            <Text style={styles.gameTitle}>第 {level} 关</Text>
            {timeLeft > 0 && <Text style={styles.gameTimer}>{timeLeft}s</Text>}
          </View>
          <Text style={styles.gameAttempts}>{attempts} 次</Text>
        </View>

        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min((matched.size / totalPairs) * 100, 100)}%` },
            ]}
          />
        </View>

        <View style={styles.cardGrid}>
          {cards.map((card) => {
            const isFlipped = flipped.includes(card.id) || matched.has(card.id);
            const isMatched = matched.has(card.id);

            return (
              <TouchableOpacity
                key={card.id}
                style={[
                  styles.card,
                  { width: cardWidth, height: cardWidth * 1.15 },
                  isFlipped && styles.cardFlipped,
                  isMatched && styles.cardMatched,
                ]}
                onPress={() => handleFlip(card.id)}
                activeOpacity={0.9}
              >
                {isFlipped ? (
                  <View style={styles.cardFront}>
                    <Text style={styles.cardEmoji}>{card.emoji}</Text>
                    <Text style={styles.cardText} numberOfLines={2}>
                      {card.text}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.cardBack}>
                    <FontAwesome6 name="question" size={26} color="#7C5CFC" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // 渲染结果
  const renderResult = () => {
    const isPerfect = attempts === cards.length / 2;
    const isTimeout = timeLeft === 0 && matched.size < cards.length;

    return (
      <View style={styles.resultContent}>
        <View style={styles.resultIconContainer}><FontAwesome6 name={isTimeout ? 'clock' : isPerfect ? 'trophy' : 'star'} size={80} color={isTimeout ? '#FF7043' : isPerfect ? '#FFCB57' : '#7C5CFC'} /></View>
        <Text style={styles.resultTitle}>
          {isTimeout ? '时间到!' : isPerfect ? '太棒了!' : '完成了!'}
        </Text>
        <View style={styles.resultStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{attempts}</Text>
            <Text style={styles.statLabel}>尝试次数</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{matched.size / 2}</Text>
            <Text style={styles.statLabel}>配对成功</Text>
          </View>
        </View>
        <View style={styles.resultButtons}>
          <TouchableOpacity
            style={[styles.resultBtn, styles.retryBtn]}
            onPress={() => startGame(level)}
          >
            <FontAwesome6 name="rotate-right" size={20} color="#7C5CFC" />
            <Text style={styles.retryText}>再玩一次</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.resultBtn, styles.homeBtn]}
            onPress={() => setScreen('age')}
          >
            <FontAwesome6 name="house" size={20} color="#8B87A0" />
            <Text style={styles.homeText}>返回首页</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Screen backgroundColor="#F0EDFA">
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {screen === 'age' && renderAgeSelection()}
        {screen === 'theme' && renderThemeSelection()}
        {screen === 'level' && renderLevelSelection()}
        {screen === 'game' && renderGame()}
        {screen === 'result' && renderResult()}
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
    paddingBottom: 40,
  },
  content: {
    padding: 24,
    paddingTop: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2D2B3D',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8B87A0',
    marginBottom: 32,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },

  // 年龄选择
  ageList: {
    gap: 16,
  },
  ageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
    borderWidth: 2,
    gap: 20,
  },
  ageIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageLabel: {
    fontSize: 22,
    fontWeight: '800',
    flex: 1,
  },
  ageDesc: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8B87A0',
  },

  // 主题选择
  themeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  themeCard: {
    width: '48%',
    padding: 24,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    marginBottom: 8,
  },
  themeIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  themeLabel: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  themeCount: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8B87A0',
  },

  // 关卡选择
  levelList: {
    gap: 12,
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    gap: 16,
  },
  levelHeader: {
    flex: 1,
  },
  levelNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2D2B3D',
  },
  levelName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C5CFC',
    marginTop: 2,
  },
  levelInfo: {
    alignItems: 'flex-end',
    gap: 4,
  },
  levelDetail: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8B87A0',
  },

  // 游戏界面
  gameContent: {
    flex: 1,
    padding: 16,
    paddingTop: 8,
  },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gameCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  gameInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  gameTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2D2B3D',
  },
  gameTimer: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF7043',
  },
  gameAttempts: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B87A0',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E8E4F5',
    borderRadius: 4,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7C5CFC',
    borderRadius: 4,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E8E4F5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardFlipped: {
    backgroundColor: '#EDE8FF',
    borderColor: '#7C5CFC',
  },
  cardMatched: {
    backgroundColor: '#E0F8EC',
    borderColor: '#5ED6A0',
  },
  cardBack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFront: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    gap: 4,
  },
  cardEmoji: {
    fontSize: 26,
    lineHeight: 30,
  },
  cardText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    color: '#2D2B3D',
    textAlign: 'center',
    flexShrink: 1,
  },

  // 结果界面
  resultContent: {
    flex: 1,
    padding: 24,
    paddingTop: 80,
    alignItems: 'center',
  },
  resultIconContainer: {
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2D2B3D',
    marginBottom: 32,
  },
  resultStats: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 40,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#7C5CFC',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8B87A0',
    marginTop: 4,
  },
  resultButtons: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  resultBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  retryBtn: {
    backgroundColor: '#EDE8FF',
  },
  retryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7C5CFC',
  },
  homeBtn: {
    backgroundColor: '#F0EDFA',
  },
  homeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8B87A0',
  },
});
