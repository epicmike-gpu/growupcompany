import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeSearchParams } from '@/hooks/useSafeRouter';
import { FontAwesome6 } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import EventSource from 'react-native-sse';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

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
};

export default function ChatScreen() {
  const { session } = useAuth();
  const { command_type } = useSafeSearchParams<{ command_type: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const commandLabel = COMMAND_LABELS[command_type] || '自由聊天';

  // Initial message based on command type
  useEffect(() => {
    if (command_type && command_type !== 'free_chat') {
      // Send the command as the first message
      const initialMessage = `请提醒我去${commandLabel}`;
      handleSendMessage(initialMessage, true);
    }
  }, [command_type]);

  const handleSendMessage = async (text: string, isInitial = false) => {
    if (!text.trim() || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsStreaming(true);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
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
          command_type: command_type || 'free_chat',
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
        // @ts-ignore - RN SSE library options
        parsers: {
          message: (data: string) => data,
        },
      });

      let accumulated = '';

      sse.addEventListener('message', (event: { data: string | null }) => {
        const data = event.data;
        if (data === '[DONE]') {
          sse.close();
          setIsStreaming(false);
          return;
        }
        try {
          const parsed = JSON.parse(data || '{}');
          if (parsed.content) {
            accumulated += parsed.content;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessage.id ? { ...m, content: accumulated } : m
              )
            );
          }
        } catch {
          // Skip malformed JSON
        }
      });

      sse.addEventListener('error', () => {
        sse.close();
        if (!accumulated) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantMessage.id));
        }
        setIsStreaming(false);
      });
    } catch (error) {
      console.error('Chat error:', error);
      Toast.show({ type: 'error', text1: '网络错误，请重试' });
      setMessages((prev) => prev.filter((m) => m.id !== assistantMessage.id));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSend = () => {
    if (inputText.trim()) {
      handleSendMessage(inputText.trim());
    }
  };

  const renderMessage = useCallback(({ item }: { item: Message }) => {
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
        </View>
        {isUser && (
          <View style={[styles.avatarContainer, styles.userAvatar]}>
            <FontAwesome6 name="user" size={16} color="#7C5CFC" />
          </View>
        )}
      </View>
    );
  }, [isStreaming]);

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerAvatar}>
              <FontAwesome6 name="star" size={18} color="#7C5CFC" solid />
            </View>
            <View>
              <Text style={styles.headerTitle}>成长精灵</Text>
              <Text style={styles.headerSubtitle}>{commandLabel}</Text>
            </View>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          showsVerticalScrollIndicator={false}
        />

        {/* Input */}
        <View style={styles.inputContainer}>
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDE8FF',
  },
  headerLeft: {
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
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
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
  },
  userMessageText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  assistantMessageText: {
    color: '#2D2B3D',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EDE8FF',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#F0EDFA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '500',
    color: '#2D2B3D',
    maxHeight: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(124,92,252,0.15)',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7C5CFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#5A3ED9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
