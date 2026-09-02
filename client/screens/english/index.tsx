import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

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

interface BestScore {
  stars: number;
  attempts: number;
}

type Screen = 'age' | 'theme' | 'level' | 'game' | 'result';

/** 朗读英文单词/句子（儿童语速稍慢、音调稍高） */
const speakWord = (text: string, rate = 0.85) => {
  Speech.stop();
  Speech.speak(text, { language: 'en-US', rate, pitch: 1.1 });
};

/** 翻牌触觉反馈 */
const hapticFlip = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
};
const hapticSuccess = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
};
const hapticFail = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
};

/** 单张记忆卡片：3D 翻转动画 + 英文卡自动发音 + 配对成功脉冲 */
// 支持 Animated 透明度驱动的触摸层（opacity 插值需要 Animated 组件承载）
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function MemoryCard({
  card,
  size,
  isFlipped,
  isMatched,
  onPress,
}: {
  card: CardData;
  size: number;
  isFlipped: boolean;
  isMatched: boolean;
  onPress: () => void;
}) {
  // 用 useState 初始化 Animated.Value（稳定引用，且避免渲染期访问 ref）
  const [flipAnim] = useState(() => new Animated.Value(0));
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const prevFlipped = useRef(false);

  // 翻转动画：翻到英文卡时自动朗读单词（学习反馈）
  useEffect(() => {
    if (isFlipped && !prevFlipped.current && card.type === 'en') {
      speakWord(card.text);
    }
    prevFlipped.current = isFlipped;
    Animated.timing(flipAnim, {
      toValue: isFlipped || isMatched ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isFlipped, isMatched, card.type, card.text, flipAnim]);

  // 配对成功：脉冲庆祝动画
  useEffect(() => {
    if (isMatched) {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.14, duration: 180, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    }
  }, [isMatched, pulseAnim]);

  // 两段式翻转（原生端稳定）：背层 0→90° 转出，正面层 90°→0° 转入。
  // 每层只有一层独立 rotateY，无嵌套旋转（原生端不支持嵌套 3D 场景合成），
  // 也不依赖 backfaceVisibility（Web 端该属性不可靠）
  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 0.5],
    outputRange: ['0deg', '90deg'],
  });
  const frontRotateY = flipAnim.interpolate({
    inputRange: [0.5, 1],
    outputRange: ['90deg', '0deg'],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.45, 0.5, 0.6, 1],
    outputRange: [0, 0, 0, 1, 1],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.45, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  const isFront = isFlipped || isMatched;

  return (
    <Animated.View style={[styles.cardWrap, { width: size, height: size * 1.15 }]}>
      {/* 正面（单词/中文） */}
      <AnimatedTouchable
        style={[
          styles.cardFace,
          isFront && styles.cardFaceFront,
          isMatched && styles.cardMatched,
          { opacity: frontOpacity, transform: [{ perspective: 1000 }, { rotateY: frontRotateY }] },
        ]}
        onPress={onPress}
        activeOpacity={0.9}
        disabled={!isFront}
      >
        <Text style={styles.cardEmoji} allowFontScaling={false}>
          {card.emoji}
        </Text>
        <Text style={[styles.cardText, card.type === 'en' && styles.cardTextEn]} numberOfLines={2}>
          {card.text}
        </Text>
        {card.type === 'en' && (
          <View style={styles.speakerTag}>
            <FontAwesome6 name="volume-high" size={9} color="#7C5CFC" />
          </View>
        )}
      </AnimatedTouchable>

      {/* 背面（问号） */}
      <AnimatedTouchable
        style={[
          styles.cardFace,
          styles.cardFaceBack,
          !isFront && styles.cardBackVisible,
          { opacity: backOpacity, transform: [{ perspective: 1000 }, { rotateY: backRotateY }] },
        ]}
        onPress={onPress}
        activeOpacity={0.9}
        disabled={isFront}
      >
        <LinearGradient
          style={styles.cardBackGradient}
          colors={['#8B72FF', '#7C5CFC', '#6B4AE0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <FontAwesome6 name="question" size={size * 0.22} color="rgba(255,255,255,0.9)" solid />
          <View style={styles.cardBackDots}>
            <View style={styles.cardBackDot} />
            <View style={[styles.cardBackDot, styles.cardBackDotSm]} />
          </View>
        </LinearGradient>
      </AnimatedTouchable>
    </Animated.View>
  );
}

/** 结果页星级 */
function StarRow({ stars }: { stars: number }) {
  return (
    <View style={styles.starRow}>
      {[0, 1, 2].map((i) => (
        <FontAwesome6
          key={i}
          name="star"
          size={46}
          color={i < stars ? '#FFCB57' : '#DDD8EC'}
          solid={i < stars}
        />
      ))}
    </View>
  );
}

export default function EnglishScreen() {
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
  const [timedOut, setTimedOut] = useState(false);
  const [levelConfig, setLevelConfig] = useState<LevelConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [bestScore, setBestScore] = useState<BestScore | null>(null);
  const [isRecord, setIsRecord] = useState(false);
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

  // 最佳成绩存储 key
  const bestKey = `${ageGroup}_${theme}_${level}`;

  // 开始游戏
  const startGame = useCallback(
    async (lvl: number) => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/cards?age=${ageGroup}&theme=${theme}&level=${lvl}`);
        const data = await res.json();
        setCards(data.data.cards || []);
        setLevelConfig(data.data.levelConfig);
        setFlipped([]);
        setMatched(new Set());
        setAttempts(0);
        setTimedOut(false);
        setIsRecord(false);
        cheeredRef.current = '';
        setTimeLeft(data.data.levelConfig.timeLimit || 0);
        // 读取历史最佳成绩
        try {
          const raw = await AsyncStorage.getItem(`english_best_${ageGroup}_${theme}_${lvl}`);
          setBestScore(raw ? (JSON.parse(raw) as BestScore) : null);
        } catch {
          setBestScore(null);
        }
        setLevel(lvl);
        setScreen('game');
      } catch (error) {
        console.error('Start game error:', error);
        Alert.alert('错误', '加载游戏失败');
      } finally {
        setLoading(false);
      }
    },
    [ageGroup, theme]
  );

  // 计时器（仅限时关卡倒计时）
  const timeLimit = levelConfig?.timeLimit ?? 0;
  useEffect(() => {
    if (screen !== 'game' || timeLimit <= 0) return;
    const t = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(t);
  }, [screen, timeLimit]);

  // 超时结束
  useEffect(() => {
    if (screen === 'game' && timeLimit > 0 && timeLeft <= 0) {
      setTimedOut(true);
      setScreen('result');
    }
  }, [screen, timeLeft, timeLimit]);

  // 离开页面时停止朗读与触觉队列
  useFocusEffect(
    useCallback(() => {
      return () => {
        Speech.stop();
      };
    }, [])
  );

  // 检查配对
  useEffect(() => {
    if (flipped.length === 2) {
      setAttempts((prev) => prev + 1);
      const [first, second] = flipped;
      const card1 = cards.find((c) => c.id === first);
      const card2 = cards.find((c) => c.id === second);

      if (card1 && card2 && card1.pairId === card2.pairId) {
        hapticSuccess();
        setTimeout(() => {
          setMatched((prev) => {
            const newSet = new Set(prev);
            newSet.add(card1.pairId);
            // 检查是否完成：已配对数 === 总对数（cards.length / 2）
            if (newSet.size === cards.length / 2) {
              setTimeout(() => setScreen('result'), 700);
            }
            return newSet;
          });
          setFlipped([]);
        }, 500);
      } else {
        hapticFail();
        setTimeout(() => {
          setFlipped([]);
        }, 800);
      }
    }
  }, [flipped, cards]);

  // 完成时计算星级并保存最佳成绩（cheeredRef 防止重复朗读/重复保存）
  const totalPairs = Math.max(cards.length / 2, 1);
  const stars = timedOut ? 0 : attempts === totalPairs ? 3 : attempts <= Math.ceil(totalPairs * 1.5) ? 2 : 1;
  const bestScoreRef = useRef<BestScore | null>(null);
  useEffect(() => {
    // 渲染后同步最新最佳成绩供 effect 读取
    bestScoreRef.current = bestScore;
  }, [bestScore]);
  const cheeredRef = useRef('');
  useEffect(() => {
    if (screen !== 'result' || timedOut) return;
    const cheerKey = `${bestKey}_${stars}_${attempts}`;
    if (cheeredRef.current === cheerKey) return;
    cheeredRef.current = cheerKey;

    const prev = bestScoreRef.current;
    const better =
      !prev || stars > prev.stars || (stars === prev.stars && attempts < prev.attempts);
    if (better) {
      setIsRecord(true);
      const best: BestScore = {
        stars: Math.max(stars, prev?.stars ?? 0),
        attempts: prev && stars === prev.stars ? Math.min(attempts, prev.attempts) : attempts,
      };
      setBestScore(best);
      AsyncStorage.setItem(`english_best_${bestKey}`, JSON.stringify(best)).catch(() => undefined);
    }
    // 完成鼓励语
    const cheer =
      stars === 3 ? 'Perfect! Amazing job!' : stars === 2 ? 'Great job!' : 'Well done! Try to be faster!';
    const timer = setTimeout(() => speakWord(cheer, 0.9), 700);
    return () => clearTimeout(timer);
  }, [screen, timedOut, stars, attempts, bestKey]);

  // 翻牌（matched 以 pairId 记录，配对成功的卡不可再翻）
  const handleFlip = (card: CardData) => {
    if (flipped.length >= 2) return;
    if (flipped.includes(card.id)) return;
    if (matched.has(card.pairId)) return;
    hapticFlip();
    setFlipped((prev) => [...prev, card.id]);
  };

  // 游戏中退出确认
  const confirmExit = () => {
    Alert.alert('退出游戏？', '当前的进度将会丢失哦', [
      { text: '继续玩', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: () => setScreen('level') },
    ]);
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
    const cols = windowWidth > 480 ? 4 : 3;
    // 卡宽随屏幕宽度自适应：预留左右 padding 32 + 卡间距 gap (cols-1)×12
    const cardWidth = Math.floor((windowWidth - 32 - (cols - 1) * 12) / cols);
    const matchedPairs = matched.size;
    const timerDanger = timeLimit > 0 && timeLeft <= 10;

    return (
      <View style={styles.gameContent}>
        <View style={styles.gameHeader}>
          <TouchableOpacity style={styles.gameCloseBtn} onPress={confirmExit}>
            <FontAwesome6 name="xmark" size={22} color="#7C5CFC" />
          </TouchableOpacity>
          <View style={styles.gameInfo}>
            <Text style={styles.gameTitle}>第 {level} 关</Text>
            <Text style={styles.gameProgress}>
              {matchedPairs}/{totalPairs} 对
            </Text>
          </View>
          {timeLimit > 0 ? (
            <Text style={[styles.gameTimer, timerDanger && styles.gameTimerDanger]}>
              {Math.max(timeLeft, 0)}s
            </Text>
          ) : (
            <Text style={styles.gameAttempts}>{attempts} 次</Text>
          )}
        </View>

        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min((matchedPairs / totalPairs) * 100, 100)}%` },
            ]}
          />
        </View>

        <View style={styles.cardGrid}>
          {cards.map((card) => {
            const isFlipped = flipped.includes(card.id);
            const isMatched = matched.has(card.pairId);

            return (
              <MemoryCard
                key={card.id}
                card={card}
                size={cardWidth}
                isFlipped={isFlipped}
                isMatched={isMatched}
                onPress={() => handleFlip(card)}
              />
            );
          })}
        </View>
      </View>
    );
  };

  // 渲染结果
  const renderResult = () => {
    const isTimeout = timedOut;

    return (
      <View style={styles.resultContent}>
        <View style={styles.resultIconContainer}>
          <FontAwesome6
            name={isTimeout ? 'clock' : 'trophy'}
            size={80}
            color={isTimeout ? '#FF7043' : '#FFCB57'}
          />
        </View>
        <Text style={styles.resultTitle}>{isTimeout ? '时间到!' : stars === 3 ? '太棒了!' : '完成了!'}</Text>

        {!isTimeout && <StarRow stars={stars} />}
        {isRecord && !isTimeout && (
          <View style={styles.recordBadge}>
            <FontAwesome6 name="crown" size={14} color="#FFCB57" solid />
            <Text style={styles.recordText}>新纪录!</Text>
          </View>
        )}

        <View style={styles.resultStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{attempts}</Text>
            <Text style={styles.statLabel}>尝试次数</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{matched.size}</Text>
            <Text style={styles.statLabel}>配对卡片</Text>
          </View>
          {bestScore && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{bestScore.stars}</Text>
              <Text style={styles.statLabel}>历史最佳</Text>
            </View>
          )}
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
            onPress={() => {
              Speech.stop();
              setScreen('age');
            }}
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
        {loading && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        )}
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
    marginBottom: 0,
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
    gap: 12,
  },
  gameTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2D2B3D',
  },
  gameProgress: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C5CFC',
    backgroundColor: '#EDE8FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gameTimer: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF7043',
    minWidth: 44,
    textAlign: 'right',
  },
  gameTimerDanger: {
    color: '#FF3B30',
    fontSize: 22,
    fontWeight: '800',
  },
  gameAttempts: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B87A0',
    minWidth: 44,
    textAlign: 'right',
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

  // 卡片（3D 翻转）
  cardWrap: {
    position: 'relative',
  },
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    backfaceVisibility: 'hidden',
  },
  cardFaceFront: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E8E4F5',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    gap: 4,
  },
  cardMatched: {
    backgroundColor: '#E0F8EC',
    borderColor: '#5ED6A0',
    opacity: 0.92,
  },
  cardFaceBack: {
    padding: 0,
  },
  cardBackVisible: {
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  cardBackGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBackDots: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  cardBackDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  cardBackDotSm: {
    width: 5,
    height: 5,
    opacity: 0.7,
  },
  cardEmoji: {
    fontSize: 28,
    lineHeight: 32,
  },
  cardText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    color: '#2D2B3D',
    textAlign: 'center',
    flexShrink: 1,
  },
  cardTextEn: {
    fontSize: 13,
    color: '#5B4BC4',
    textTransform: 'capitalize',
  },
  speakerTag: {
    position: 'absolute',
    top: 5,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EDE8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 加载
  loadingOverlay: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7C5CFC',
  },

  // 结果界面
  resultContent: {
    flex: 1,
    padding: 24,
    paddingTop: 64,
    alignItems: 'center',
  },
  resultIconContainer: {
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2D2B3D',
    marginBottom: 20,
  },
  starRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  recordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF6DC',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    marginBottom: 20,
  },
  recordText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B8860B',
  },
  resultStats: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 36,
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
