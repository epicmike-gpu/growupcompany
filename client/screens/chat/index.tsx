import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { GlassStarBall } from '@/components/GlassStarBall';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  getWaterIntervalMinutes,
  WATER_CHAT_LINES,
} from '@/utils/waterReminder';
import Toast from 'react-native-toast-message';
import EventSource from 'react-native-sse';
import { Audio } from 'expo-av';
import { createFormDataFile } from '@/utils';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  englishText?: string;
  audioUri?: string;
  englishAudioUri?: string;
  kind?: 'chat' | 'water';
}

// Split bilingual LLM output: Chinese part + `---EN---` separator + English part
const splitBilingual = (raw: string): { zh: string; en: string } => {
  const idx = raw.indexOf('---EN---');
  if (idx === -1) return { zh: raw, en: '' };
  return { zh: raw.slice(0, idx), en: raw.slice(idx + 8) };
};

// command_type → 发给 LLM 的初始话术（普通任务=提醒去做好件事；赞美类=请精灵夸夸我）
const COMMAND_LABELS: Record<string, string> = {
  drink_water: '喝水',
  sleep: '睡觉',
  rest: '休息',
  bath: '洗澡',
  eat_vegetables: '吃蔬菜',
  brush_teeth: '刷牙',
  exercise: '运动',
  study: '学习',
  free_chat: '自由聊天',
  // 生活习惯类
  dress_up: '自己穿衣',
  pack_bag: '收拾书包',
  wash_hands: '饭前洗手',
  nap: '午睡',
  // 健康身体类
  eat_fruit: '吃水果',
  sit_straight: '坐姿端正',
  breathe: '深呼吸放松',
  // 赞美类
  praise_day: '今天真棒',
  strength: '优点大发现',
};

// 赞美类不用"请提醒我去XX"句式，用专属话术
const PRAISE_COMMAND_TEXT: Record<string, string> = {
  praise_day: '请夸夸我今天的表现，问问我今天做了什么，然后真诚地表扬我',
  strength: '请和我玩"优点大发现"游戏，帮我发现我身上的优点，然后夸夸我',
};

// TTS player component for AI messages
function TTSPlayer({
  audioUri,
  onBeforePlay,
}: {
  audioUri: string;
  onBeforePlay?: () => void;
}) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handlePlay = async () => {
    try {
      if (isPlaying) {
        if (soundRef.current) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        setIsPlaying(false);
        return;
      }

      setIsLoading(true);
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      // Stop auto-playing audio to avoid overlapping sounds
      onBeforePlay?.();

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, isLooping: false },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
          }
        }
      );
      soundRef.current = sound;
      setIsPlaying(true);
      setIsLoading(false);
    } catch (error) {
      console.error('TTS play error:', error);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, []);

  return (
    <TouchableOpacity onPress={handlePlay} disabled={isLoading} style={styles.ttsButton}>
      {isLoading ? (
        <ActivityIndicator size="small" color="#7C5CFC" />
      ) : (
        <FontAwesome6
          name={isPlaying ? 'stop' : 'volume-high'}
          size={16}
          color={isPlaying ? '#F472B6' : '#7C5CFC'}
          solid
        />
      )}
    </TouchableOpacity>
  );
}

export default function ChatScreen() {
  const router = useSafeRouter();
  const { session } = useAuth();
  const { command_type, commandId, commandText: commandTextParam } = useSafeSearchParams<{
    command_type: string;
    commandId?: number;
    commandText?: string;
  }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('voice');
  const [englishTutor, setEnglishTutor] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const autoSoundRef = useRef<Audio.Sound | null>(null);
  // Resolves the pending auto-play chain when audio is manually stopped
  const autoPlayResolveRef = useRef<(() => void) | null>(null);
  const autoPlayCancelledRef = useRef(false);
  // Typewriter interval for showing English text
  const autoTypeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scaleAnim = useMemo(() => new Animated.Value(1), []);

  const commandLabel = COMMAND_LABELS[command_type] || '自由聊天';

  // Request mic permission on mount
  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setHasMicPermission(status === 'granted');
    })();
  }, []);

  // 键盘弹出时把列表拉到底，避免最新消息被键盘挡住
  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => {
      flatListRef.current?.scrollToEnd({ animated: false });
    });
    return () => sub.remove();
  }, []);

  // Initial message based on command type
  // Tabs 导航下聊天页不会卸载，必须用"每次进入的唯一 commandId"判断是否发送，
  // 而不是一次性 boolean ref（否则第二次从首页点指令进来不会再发送）
  const lastSentCommandIdRef = useRef<number | null>(null);
  const nextIdRef = useRef(0);

  // 插入一条"喝水提醒"消息（不消耗聊天次数，不走 LLM）
  const insertWaterReminder = useCallback(() => {
    const line =
      WATER_CHAT_LINES[Math.floor(Math.random() * WATER_CHAT_LINES.length)];
    setMessages((prev) => [
      ...prev,
      {
        id: `w-${++nextIdRef.current}`,
        role: 'assistant',
        content: line,
        kind: 'water',
      },
    ]);
  }, []);

  // 喝水提醒：进入聊天页时读取开关；开启则按小朋友年龄对应的间隔定时提醒
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let timer: ReturnType<typeof setInterval> | null = null;

      (async () => {
        try {
          const token = session?.access_token;
          if (!token) return;
          /**
           * 服务端文件：server/src/routes/profile.ts
           * 接口：GET /api/v1/profile
           * Headers: x-session: string
           */
          const res = await fetch(
            `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/profile`,
            { headers: { 'x-session': token } },
          );
          if (!res.ok) return;
          const profile = await res.json();
          if (cancelled || !profile?.water_reminder_enabled) return;
          const minutes = getWaterIntervalMinutes(profile?.age ?? 5);
          timer = setInterval(insertWaterReminder, minutes * 60 * 1000);
        } catch {
          // 拉取失败不影响聊天功能
        }
      })();

      return () => {
        cancelled = true;
        if (timer) clearInterval(timer);
      };
    }, [session?.access_token, insertWaterReminder]),
  );

  const handleSendMessage = async (text: string, msgCommandType?: string) => {
    if (!text.trim() || isStreaming) return;

    const userMessage: Message = {
      id: `u-${++nextIdRef.current}`,
      role: 'user',
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsStreaming(true);

    const assistantMessage: Message = {
      id: `a-${++nextIdRef.current}`,
      role: 'assistant',
      content: '',
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const token = session?.access_token;
      if (!token) {
        Toast.show({ type: 'error', text1: '请先登录' });
        setIsStreaming(false);
        return;
      }

      const sse = new EventSource(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session': token,
        },
        body: JSON.stringify({
          message: text,
          // 指令类型跟随消息本身：进入页面时的首条指令用页面的 command_type，
          // 之后的对话消息一律按 free_chat 处理，话题靠 history 延续
          command_type: msgCommandType || 'free_chat',
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          english_tutor: englishTutor,
        }),
        // @ts-ignore - RN SSE library options
        parsers: {
          message: (data: string) => data,
        },
      });

      let accumulated = '';
      let accumulatedEn = '';

      sse.addEventListener('message', (event: { data: string | null }) => {
        const data = event.data;
        if (data === '[DONE]') {
          sse.close();
          setIsStreaming(false);
          // 回复结束：等最后一帧渲染完成后强制贴底，保证无需手动上滑
          requestAnimationFrame(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          });
          // Reset the cancel flag so the new auto-play chain is allowed to run
          autoPlayCancelledRef.current = false;
          // Sequential flow (English Tutor mode):
          //   Chinese text (already streamed) -> play Chinese voice
          //   -> typewriter English text -> play English voice
          const zh = accumulated.trim();
          const en = accumulatedEn.trim();
          // 兜底：LLM 格式错乱导致中文段为空时，把英语内容作为主文本显示，
          // 避免出现"回复是空的/只有英语语音"的情况
          if (!zh && en) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessage.id
                  ? { ...m, content: en, englishText: undefined }
                  : m
              )
            );
          }
          const chain = (async () => {
            if (zh) {
              await autoPlayTTS(zh, assistantMessage.id, 'zh');
            } else if (en) {
              await autoPlayTTS(en, assistantMessage.id, 'zh');
              return;
            }
            if (!en || autoPlayCancelledRef.current) return;
            await typeEnglishText(assistantMessage.id, en);
            if (autoPlayCancelledRef.current) return;
            await autoPlayTTS(en, assistantMessage.id, 'en');
          })();
          chain.catch((err) => console.warn('自动播放链中断:', err));
          return;
        }
        try {
          const parsed = JSON.parse(data || '{}');
          if (parsed.content) {
            if (parsed.lang === 'en') {
              accumulatedEn += parsed.content;
              // English text is NOT shown in realtime;
              // it will be revealed by typewriter AFTER the Chinese voice finishes.
            } else {
              accumulated += parsed.content;
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessage.id
                  ? { ...m, content: accumulated }
                  : m
              )
            );
          }
        } catch {
          // Skip malformed JSON
        }
      });

      sse.addEventListener('error', (event) => {
        sse.close();
        if (!accumulated) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantMessage.id));
        }
        setIsStreaming(false);
        // 次数用完：后端返回 403（QUOTA_EXHAUSTED）
        if ((event as { status?: number })?.status === 403) {
          Alert.alert('次数已用完', '聊天次数已经用完啦，请充值后继续和小精灵聊天哦', [
            { text: '知道了', style: 'cancel' },
            { text: '去充值', onPress: () => router.navigate('/paywall') },
          ]);
        }
      });
    } catch (error) {
      console.error('Chat error:', error);
      Toast.show({ type: 'error', text1: '网络错误，请重试' });
      setMessages((prev) => prev.filter((m) => m.id !== assistantMessage.id));
      setIsStreaming(false);
    }
  };

  const autoPlayTTS = async (
    text: string,
    messageId: string,
    lang: 'zh' | 'en' = 'zh'
  ): Promise<string | undefined> => {
    try {
      const token = session?.access_token;
      if (!token) return undefined;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/voice/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session': token,
        },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      if (!data.success || !data.audioUri) return undefined;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? lang === 'en'
              ? { ...m, englishAudioUri: data.audioUri }
              : { ...m, audioUri: data.audioUri }
            : m
        )
      );

      // Auto-play the audio
      await playAudio(data.audioUri);
      return data.audioUri;
    } catch (error) {
      console.error('Auto TTS error:', error);
      return undefined;
    }
  };

  // Stop the auto-playing sound and any pending text typewriter
  // (called when a manual action interrupts the auto-play chain)
  const stopAutoSound = () => {
    if (autoSoundRef.current) {
      autoSoundRef.current.unloadAsync().catch((err: Error) =>
        console.warn('Failed to unload audio', err)
      );
      autoSoundRef.current = null;
    }
    if (autoTypeIntervalRef.current) {
      clearInterval(autoTypeIntervalRef.current);
      autoTypeIntervalRef.current = null;
    }
    // If an auto-play chain is pending (e.g. waiting for Chinese to finish
    // before playing English), resolve it immediately so the chain moves on
    // (the chain checks autoPlayCancelledRef and skips the next step).
    autoPlayCancelledRef.current = true;
    if (autoPlayResolveRef.current) {
      autoPlayResolveRef.current();
      autoPlayResolveRef.current = null;
    }
  };

  const playAudio = (audioUri: string): Promise<void> => {
    return new Promise((resolve) => {
      let finished = false;
      let poll: ReturnType<typeof setInterval> | null = null;
      let sound: Audio.Sound | null = null;

      const finish = () => {
        if (finished) return;
        finished = true;
        if (poll) {
          clearInterval(poll);
          poll = null;
        }
        if (autoPlayResolveRef.current) {
          autoPlayResolveRef.current = null;
        }
        if (sound && autoSoundRef.current === sound) {
          autoSoundRef.current = null;
          sound.unloadAsync().catch((err: Error) =>
            console.warn('Failed to unload audio', err)
          );
        }
        resolve();
      };

      (async () => {
        try {
          // Stop previous audio before playing new one
          if (autoSoundRef.current) {
            const prev = autoSoundRef.current;
            autoSoundRef.current = null;
            await prev.unloadAsync().catch((err: Error) =>
              console.warn('Failed to unload audio', err)
            );
          }

          // Switch audio mode from recording to playback (iOS)
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
          });

          const { sound: created } = await Audio.Sound.createAsync(
            { uri: audioUri },
            { isLooping: false }
          );
          sound = created;
          autoSoundRef.current = sound;
          autoPlayResolveRef.current = finish;

          // Register listener BEFORE playback starts (short audio may finish
          // before a late listener would receive didJustFinish)
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              finish();
            }
          });
          await sound.playAsync();

          // Polling fallback in case didJustFinish never fires on some devices
          poll = setInterval(() => {
            sound
              ?.getStatusAsync()
              .then((st) => {
                if (!st.isLoaded) {
                  finish();
                  return;
                }
                if (st.didJustFinish) {
                  finish();
                  return;
                }
                if (
                  st.durationMillis &&
                  st.durationMillis > 0 &&
                  st.positionMillis >= st.durationMillis - 120
                ) {
                  finish();
                }
              })
              .catch(() => finish());
          }, 300);

          // Safety: if playback never starts (e.g. broken URI), resolve after timeout
          setTimeout(finish, 60000);
        } catch (error) {
          console.error('Audio play error:', error);
          resolve();
        }
      })();
    });
  };

  // Typewriter effect: reveal English text progressively (sequential flow:
  // Chinese voice finishes -> English text types out -> English voice plays)
  const typeEnglishText = (messageId: string, text: string): Promise<void> => {
    return new Promise((resolve) => {
      let index = 0;
      const timer = setInterval(() => {
        // Bail out if the chain was cancelled mid-typing
        if (autoPlayCancelledRef.current) {
          clearInterval(timer);
          autoTypeIntervalRef.current = null;
          // Still show the full text so nothing is lost
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId ? { ...m, englishText: text } : m
            )
          );
          resolve();
          return;
        }
        index = Math.min(index + 2, text.length);
        const slice = text.slice(0, index);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, englishText: slice } : m))
        );
        if (index >= text.length) {
          clearInterval(timer);
          autoTypeIntervalRef.current = null;
          resolve();
        }
      }, 45);
      autoTypeIntervalRef.current = timer;
    });
  };

  // Send initial reminder message when entering with a command
  // Tabs 导航下聊天页不会卸载，必须用"每次进入的唯一 commandId"判断是否发送，
  // 而不是一次性 boolean ref（否则第二次从首页点指令进来不会再发送）
  useEffect(() => {
    if (!command_type || command_type === 'free_chat') return;
    if (typeof commandId !== 'number') return;
    if (lastSentCommandIdRef.current === commandId) return;
    lastSentCommandIdRef.current = commandId;
    // 新指令库（100 种）由首页直接传完整话术；旧入口走本地映射兜底
    const commandText =
      commandTextParam || PRAISE_COMMAND_TEXT[command_type] || `请提醒我去${commandLabel}`;
    handleSendMessage(commandText, command_type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandId]);

  // Cleanup auto-playing sound on unmount
  useEffect(() => {
    return () => {
      if (autoSoundRef.current) {
        autoSoundRef.current.unloadAsync().catch((err: Error) =>
          console.warn('Failed to unload audio', err)
        );
        autoSoundRef.current = null;
      }
    };
  }, []);

  const handleSend = () => {
    if (inputText.trim()) {
      handleSendMessage(inputText.trim());
    }
  };

  // Push-to-talk recording
  const startRecording = async () => {
    if (!hasMicPermission) {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('需要权限', '请授予麦克风权限以使用语音对话');
        return;
      }
      setHasMicPermission(true);
    }

    // 停止正在自动播报的语音：
    // 1. 避免麦克风把精灵播报的声音录进去，导致 ASR 转出上一条回复内容
    // 2. 避免 iOS 录音模式与播放冲突
    stopAutoSound();

    if (isStreaming) {
      Toast.show({ type: 'info', text1: '精灵正在说话，请稍等' });
      return;
    }

    // 清理可能残留的旧录音对象（已 unload 的对象二次 stop 会抛错，需捕获）
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // ignore
      }
      recordingRef.current = null;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);

      // Animate scale
      Animated.spring(scaleAnim, {
        toValue: 1.2,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error('录音失败:', error);
      Toast.show({ type: 'error', text1: '录音启动失败' });
    }
  };

  const stopRecording = async () => {
    // 无论是否有进行中的录音，都先把按钮动画复位
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    if (!recordingRef.current) return;

    const recording = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);

    // 先读取录音时长（unload 后不可再查），失败时视为有效录音
    let durationMs = -1;
    try {
      const status = (await recording.getStatusAsync()) as unknown as {
        durationMillis?: number;
      };
      if (typeof status?.durationMillis === 'number') {
        durationMs = status.durationMillis;
      }
    } catch {
      // ignore
    }

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      // 立即切回播放模式，否则 iOS 上录音模式会导致后续语音播放静音
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (uri) {
        // 最短录音时长校验：按住时间太短（<600ms）录到的多半是杂音/半截声音，不发送
        if (durationMs >= 0 && durationMs < 600) {
          Toast.show({ type: 'info', text1: '说话时间太短啦', text2: '请按住按钮再说一次' });
          return;
        }
        await sendVoiceMessage(uri);
      }
    } catch (error) {
      console.error('停止录音失败:', error);
      Toast.show({ type: 'error', text1: '录音处理失败' });
    }
  };

  const sendVoiceMessage = async (audioUri: string) => {
    try {
      const token = session?.access_token;
      if (!token) {
        Toast.show({ type: 'error', text1: '请先登录' });
        return;
      }

      setIsStreaming(true);

      // Upload audio for ASR
      const formData = new FormData();
      const file = await createFormDataFile(audioUri, 'voice.m4a', 'audio/m4a');
      formData.append('audio', file as any);

      const asrResponse = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/voice/asr`, {
        method: 'POST',
        headers: {
          'x-session': token,
        },
        body: formData,
      });

      const asrData = await asrResponse.json();
      if (!asrData.success || !asrData.text) {
        Toast.show({ type: 'error', text1: '语音识别失败，请重试' });
        setIsStreaming(false);
        return;
      }

      // Send transcribed text to chat (handleSendMessage will add user + assistant messages)
      handleSendMessage(asrData.text);
    } catch (error) {
      console.error('Voice send error:', error);
      Toast.show({ type: 'error', text1: '语音发送失败' });
      setIsStreaming(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    // 喝水提醒卡片：居中浅蓝水滴样式，非普通聊天气泡
    if (item.kind === 'water') {
      return (
        <View style={styles.waterReminderRow}>
          <View style={styles.waterReminderCard}>
            <View style={styles.waterIconWrap}>
              <FontAwesome6 name="droplet" size={14} color="#0284C7" solid />
            </View>
            <Text style={styles.waterReminderText}>{item.content}</Text>
          </View>
        </View>
      );
    }
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser && styles.userMessageRow]}>
        {!isUser && (
          <View style={styles.avatarContainer}>
            <FontAwesome6 name="star" size={14} color="#7C5CFC" solid />
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userMessageText : styles.assistantMessageText,
            ]}
          >
            {item.content || (isStreaming && !isUser ? '...' : '')}
          </Text>
          {!isUser && item.englishText ? (
            <View style={styles.englishSection}>
              <View style={styles.englishBadge}>
                <FontAwesome6 name="earth-asia" size={9} color="#F472B6" solid />
                <Text style={styles.englishBadgeText}>English</Text>
              </View>
              <Text style={styles.englishMessageText}>{item.englishText}</Text>
              {item.englishAudioUri && (
                <TTSPlayer audioUri={item.englishAudioUri} onBeforePlay={stopAutoSound} />
              )}
            </View>
          ) : null}
          {!isUser && item.audioUri && (
            <TTSPlayer audioUri={item.audioUri} onBeforePlay={stopAutoSound} />
          )}
        </View>
        {isUser && (
          <View style={[styles.avatarContainer, styles.userAvatar]}>
            <FontAwesome6 name="user" size={16} color="#7C5CFC" />
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen backgroundColor="#F0EDFA" safeAreaEdges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <GlassStarBall size={40} />
            <View>
              <Text style={styles.headerTitle}>成长精灵</Text>
              <Text style={styles.headerSubtitle}>{commandLabel}</Text>
            </View>
          </View>
          {/* English Tutor toggle */}
          <TouchableOpacity
            style={[
              styles.tutorToggle,
              englishTutor && styles.tutorToggleActive,
            ]}
            onPress={() => setEnglishTutor((v) => !v)}
            activeOpacity={0.8}
          >
            <FontAwesome6
              name="earth-asia"
              size={13}
              color={englishTutor ? '#FFFFFF' : '#7C5CFC'}
              solid
            />
            <Text
              style={[
                styles.tutorToggleText,
                englishTutor && styles.tutorToggleTextActive,
              ]}
            >
              English Tutor
            </Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        />

        {/* Input Area */}
        <View style={styles.inputContainer}>
          {inputMode === 'text' ? (
            <>
              <View style={styles.voiceBar}>
                <TextInput
                  style={styles.input}
                  placeholder="说点什么..."
                  placeholderTextColor="#8B87A0"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={500}
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={!inputText.trim() || isStreaming}
                >
                  {isStreaming ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <FontAwesome6 name="paper-plane" size={18} color="#FFFFFF" solid />
                  )}
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.modeToggleButton}
                onPress={() => setInputMode('voice')}
              >
                <FontAwesome6 name="microphone" size={20} color="#7C5CFC" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.voiceBar}>
                {/* Push-to-talk button */}
                <Animated.View
                  style={[
                    styles.voiceButtonWrapper,
                    { transform: [{ scale: scaleAnim }] },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.voiceButton,
                      isRecording && styles.voiceButtonActive,
                    ]}
                    onPressIn={startRecording}
                    onPressOut={stopRecording}
                    disabled={isStreaming}
                    activeOpacity={0.7}
                  >
                    <FontAwesome6
                      name="microphone"
                      size={22}
                      color={isRecording ? '#FFFFFF' : '#7C5CFC'}
                      solid
                    />
                  </TouchableOpacity>
                </Animated.View>
                <TouchableOpacity
                  style={styles.voiceHint}
                  activeOpacity={0.6}
                  onPressIn={startRecording}
                  onPressOut={stopRecording}
                  disabled={isStreaming}
                >
                  <Text style={styles.voiceHintText}>
                    {isRecording ? '松开结束录音' : '按住说话'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.modeToggleButton}
                onPress={() => setInputMode('text')}
              >
                <FontAwesome6 name="keyboard" size={20} color="#7C5CFC" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
      <Toast />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0EDFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F0EDFA',
    borderBottomWidth: 0,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE8FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D2B3D',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8B87A0',
    marginTop: 2,
  },
  tutorToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1EEFF',
    borderWidth: 1.5,
    borderColor: '#7C5CFC',
  },
  tutorToggleActive: {
    backgroundColor: '#7C5CFC',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  tutorToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C5CFC',
  },
  tutorToggleTextActive: {
    color: '#FFFFFF',
  },
  englishSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124,92,252,0.12)',
    gap: 6,
  },
  englishBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(244,114,182,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  englishBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F472B6',
    letterSpacing: 0.5,
  },
  englishMessageText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#5B5770',
    fontWeight: '500',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 16,
  },
  waterReminderRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 6,
  },
  waterReminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E0F2FE',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  waterIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterReminderText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#0C4A6E',
    fontWeight: '500',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDE8FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  userAvatar: {
    backgroundColor: '#FFFFFF',
  },
  messageBubble: {
    maxWidth: '70%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userBubble: {
    backgroundColor: '#7C5CFC',
    borderBottomRightRadius: 6,
    shadowColor: '#5A3ED9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  userMessageText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  assistantMessageText: {
    color: '#2D2B3D',
    fontWeight: '500',
  },
  ttsButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#F0EDFA',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
    minHeight: 28,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: '#F0EDFA',
    gap: 10,
    minHeight: 64,
  },
  voiceBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E2DAFF',
    paddingVertical: 6,
    paddingHorizontal: 14,
    minHeight: 52,
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '500',
    color: '#2D2B3D',
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C5CFC',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5A3ED9',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  modeToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EDE8FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#7C5CFC',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  voiceButtonActive: {
    backgroundColor: '#7C5CFC',
    transform: [{ scale: 1.05 }],
  },
  voiceHint: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
  },
  voiceHintText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B87A0',
  },
});
