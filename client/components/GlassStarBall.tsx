import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type GlassStarBallProps = {
  size?: number;
  starSize?: number;
  spin?: boolean;
  color?: string;
};

/**
 * 纯绘制玻璃球星星（不使用系统模糊 API）：
 * 多层渐变 + 高光模拟磨砂玻璃质感，兼容 iOS/Android/Web，
 * 可安全配合 transform 动画（expo-blur 在 iOS 上与连续动画组合会截断渲染）。
 */
export function GlassStarBall({
  size = 40,
  starSize,
  spin = true,
  color = '#FFD24C',
}: GlassStarBallProps) {
  const star = starSize ?? Math.round(size * 0.44);

  const rot = useSharedValue(0);
  useEffect(() => {
    if (!spin) return;
    rot.value = withRepeat(
      withTiming(360, { duration: 4200, easing: Easing.linear }),
      -1,
      false
    );
  }, [spin, rot]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 700 }, { rotateY: `${rot.value}deg` }],
  }));

  return (
    <View
      style={[
        styles.ball,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.55)',
          'rgba(255,255,255,0.18)',
          'rgba(150,130,255,0.30)',
        ]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.highlight,
          {
            width: size * 0.42,
            height: size * 0.2,
            borderRadius: size * 0.2,
            top: size * 0.12,
            left: size * 0.16,
          },
        ]}
      />
      <View style={styles.starWrap}>
        <Animated.View style={spin ? spinStyle : undefined}>
          <FontAwesome6 name="star" size={star} color={color} solid />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ball: {
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlight: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  starWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
