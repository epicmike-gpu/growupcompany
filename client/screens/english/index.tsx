import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '@/components/Screen';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

interface Card {
  id: string;
  en: string;
  zh: string;
  emoji: string;
}

interface GameCard extends Card {
  uid: string; // unique id for each card instance
  type: 'en' | 'zh';
  matched: boolean;
  flipped: boolean;
}

type Theme = { key: string; label: string; emoji: string; color: string };

const THEME_ICONS: Record<string, string> = {
  animals: 'paw',
  fruits: 'apple-whole',
  foods: 'utensils',
};

const THEME_COLORS: Record<string, string[]> = {
  animals: ['#FF8A65', '#FF7043'],
  fruits: ['#66BB6A', '#43A047'],
  foods: ['#FFA726', '#FB8C00'],
};

export default function EnglishScreen() {
  const router = useSafeRouter();
  const { session } = useAuth();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [cards, setCards] = useState<GameCard[]>([]);
  const [flippedCards, setFlippedCards] = useState<string[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [totalPairs, setTotalPairs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const animValues = useRef<Record<string, Animated.Value>>({});

  // Fetch themes
  const fetchThemes = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/english/themes`);
      if (response.ok) {
        const data = await response.json();
        setThemes(data);
      }
    } catch (error) {
      console.error('Fetch themes error:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchThemes();
      // Reset game state when returning
      setSelectedTheme(null);
      setCards([]);
      setFlippedCards([]);
      setMatchedPairs(0);
      setGameComplete(false);
      setAttempts(0);
    }, [fetchThemes])
  );

  // Start game with selected theme
  const startGame = useCallback(async (themeKey: string) => {
    setLoading(true);
    setSelectedTheme(themeKey);
    setFlippedCards([]);
    setMatchedPairs(0);
    setGameComplete(false);
    setAttempts(0);

    try {
      const response = await fetch(
        `${API_BASE}/api/v1/english/cards?theme=${themeKey}&count=6`
      );
      if (response.ok) {
        const data = await response.json();
        // Create pairs: one EN card + one ZH card for each word
        const gameCards: GameCard[] = [];
        data.cards.forEach((card: Card) => {
          const enCard: GameCard = {
            ...card,
            uid: `${card.id}_en`,
            type: 'en',
            matched: false,
            flipped: false,
          };
          const zhCard: GameCard = {
            ...card,
            uid: `${card.id}_zh`,
            type: 'zh',
            matched: false,
            flipped: false,
          };
          gameCards.push(enCard, zhCard);
        });
        // Shuffle
        const shuffled = gameCards.sort(() => Math.random() - 0.5);
        setCards(shuffled);
        setTotalPairs(data.cards.length);
      }
    } catch (error) {
      console.error('Fetch cards error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get or create animated value for a card
  const getAnimValue = (uid: string) => {
    if (!animValues.current[uid]) {
      animValues.current[uid] = new Animated.Value(1);
    }
    return animValues.current[uid];
  };

  // Handle card tap
  const handleCardTap = useCallback(
    (uid: string) => {
      if (flippedCards.length >= 2) return;
      if (flippedCards.includes(uid)) return;

      const card = cards.find((c) => c.uid === uid);
      if (!card || card.matched) return;

      // Animate flip
      const animVal = getAnimValue(uid);
      Animated.sequence([
        Animated.timing(animVal, { toValue: 0.85, duration: 100, useNativeDriver: true }),
        Animated.timing(animVal, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();

      const newFlipped = [...flippedCards, uid];
      setFlippedCards(newFlipped);

      // Check match when 2 cards flipped
      if (newFlipped.length === 2) {
        setAttempts((prev) => prev + 1);
        const [firstUid, secondUid] = newFlipped;
        const firstCard = cards.find((c) => c.uid === firstUid)!;
        const secondCard = cards.find((c) => c.uid === secondUid)!;

        if (firstCard.id === secondCard.id && firstCard.type !== secondCard.type) {
          // Match!
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                c.uid === firstUid || c.uid === secondUid ? { ...c, matched: true } : c
              )
            );
            setFlippedCards([]);
            const newMatched = matchedPairs + 1;
            setMatchedPairs(newMatched);
            if (newMatched === totalPairs) {
              setGameComplete(true);
            }
          }, 500);
        } else {
          // No match - flip back
          setTimeout(() => {
            setFlippedCards([]);
          }, 800);
        }
      }
    },
    [cards, flippedCards, matchedPairs, totalPairs]
  );

  const theme = themes.find((t) => t.key === selectedTheme);
  const colors = selectedTheme ? THEME_COLORS[selectedTheme] : ['#7C5CFC', '#5A3FD6'];

  // Theme selection screen
  if (!selectedTheme) {
    return (
      <Screen>
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <FontAwesome6 name="chevron-left" size={20} color="#4A4560" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>学英语</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.heroBanner}>
            <FontAwesome6 name="book-open" size={48} color="#7C5CFC" solid />
            <Text style={styles.heroTitle}>卡片对对碰</Text>
            <Text style={styles.heroSubtitle}>选一个主题，翻开卡片配对学英语!</Text>
          </View>

          <Text style={styles.sectionTitle}>选择主题</Text>
          <View style={styles.themeGrid}>
            {themes.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.themeCard, { backgroundColor: t.color }]}
                onPress={() => startGame(t.key)}
                activeOpacity={0.8}
              >
                <FontAwesome6 name={THEME_ICONS[t.key] || 'star'} size={36} color="#FFFFFF" solid />
                <Text style={styles.themeLabel}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Screen>
    );
  }

  // Game screen
  return (
    <Screen>
      <View style={styles.gameContainer}>
        {/* Header */}
        <View style={styles.gameHeader}>
          <TouchableOpacity onPress={() => setSelectedTheme(null)} style={styles.backBtn}>
            <FontAwesome6 name="chevron-left" size={20} color="#4A4560" />
          </TouchableOpacity>
          <View style={styles.gameInfo}>
            <Text style={styles.gameThemeTitle}>
              <FontAwesome6 name={THEME_ICONS[selectedTheme] || 'star'} size={16} color={colors[0]} solid />{' '}
              {theme?.label}
            </Text>
            <Text style={styles.gameStats}>
              已配对 {matchedPairs}/{totalPairs} · 尝试 {attempts} 次
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${totalPairs > 0 ? (matchedPairs / totalPairs) * 100 : 0}%`,
                backgroundColor: colors[0],
              },
            ]}
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors[0]} />
          </View>
        ) : gameComplete ? (
          <View style={styles.completeContainer}>
            <LinearGradient colors={colors as [string, string]} style={styles.completeCard} start={{ x: 0, y: 0 } as any} end={{ x: 1, y: 1 } as any}>
              <FontAwesome6 name="trophy" size={64} color="#FFFFFF" solid />
              <Text style={styles.completeTitle}>太棒了!</Text>
              <Text style={styles.completeSubtitle}>
                你用 {attempts} 次完成了所有配对!
              </Text>
              <View style={styles.completeBtnRow}>
                <TouchableOpacity
                  style={styles.completeBtnOutline}
                  onPress={() => startGame(selectedTheme)}
                >
                  <Text style={styles.completeBtnOutlineText}>再玩一次</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.completeBtnFilled}
                  onPress={() => setSelectedTheme(null)}
                >
                  <Text style={styles.completeBtnFilledText}>换主题</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.cardGrid}>
            {cards.map((card) => {
              const isFlipped = flippedCards.includes(card.uid);
              const isMatched = card.matched;
              const showFront = isFlipped || isMatched;
              const animVal = getAnimValue(card.uid);

              return (
                <Animated.View key={card.uid} style={{ transform: [{ scale: animVal }] }}>
                  <TouchableOpacity
                    style={[
                      styles.gameCard,
                      {
                        backgroundColor: isMatched
                          ? '#E8F5E9'
                          : isFlipped
                          ? colors[0] + '20'
                          : '#FFFFFF',
                        borderColor: isMatched
                          ? '#66BB6A'
                          : isFlipped
                          ? colors[0]
                          : '#E8E4F0',
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => handleCardTap(card.uid)}
                    activeOpacity={0.8}
                    disabled={isMatched}
                  >
                    {showFront ? (
                      <>
                        {card.emoji ? (
                          <Text style={styles.cardEmoji}>{card.emoji}</Text>
                        ) : (
                          <FontAwesome6 name={card.type === 'en' ? 'font' : 'language'} size={28} color="#C4BFD6" />
                        )}
                        <Text
                          style={[
                            styles.cardText,
                            { color: isMatched ? '#43A047' : colors[1] },
                          ]}
                        >
                          {card.type === 'en' ? card.en : card.zh}
                        </Text>
                        <Text style={styles.cardTypeLabel}>
                          {card.type === 'en' ? 'English' : '中文'}
                        </Text>
                      </>
                    ) : (
                      <FontAwesome6 name="question" size={28} color="#C4BFD6" />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0FF',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D2B3D',
  },
  heroBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2D2B3D',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#8B87A0',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D2B3D',
    marginBottom: 16,
  },
  themeGrid: {
    gap: 16,
  },
  themeCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  themeEmoji: {
    fontSize: 36,
  },
  themeLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Game styles
  gameContainer: {
    flex: 1,
    backgroundColor: '#F5F0FF',
  },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 8,
  },
  gameInfo: {
    flex: 1,
    alignItems: 'center',
  },
  gameThemeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D2B3D',
  },
  gameStats: {
    fontSize: 12,
    color: '#8B87A0',
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#E8E4F0',
    marginHorizontal: 16,
    borderRadius: 3,
    marginBottom: 12,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
    justifyContent: 'center',
  },
  gameCard: {
    width: 100,
    height: 120,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cardEmoji: {
    fontSize: 32,
  },
  cardText: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardTypeLabel: {
    fontSize: 10,
    color: '#8B87A0',
  },

  // Complete styles
  completeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  completeCard: {
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  completeEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  completeSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 24,
  },
  completeBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  completeBtnOutline: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  completeBtnOutlineText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  completeBtnFilled: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  completeBtnFilledText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7C5CFC',
  },
});
