import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import Toast from 'react-native-toast-message';

const APP_ICON = 'https://coze-coding-project.tos.coze.site/gen_project_icon/2026-08-16/7674509627962163263_1786863217.png?sign=4908927271-aa980cca83-0-646b6e68e1f94d1f4209f0d945cf92ea5f18018150474527db0b422964fd3680';
const APP_NAME = '成长陪伴精灵App';

export default function LoginScreen() {
  const { signInWithOtp, verifyOtp, signInAsGuest, isAuthenticated } = useAuth();
  const router = useSafeRouter();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const otpRefs = useRef<(TextInput | null)[]>([]);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (countdown > 0) {
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [countdown]);

  const handleSendOtp = async () => {
    if (phone.length < 11) {
      Toast.show({ type: 'error', text1: '请输入正确的手机号' });
      return;
    }
    setLoading(true);
    const result = await signInWithOtp(phone);
    setLoading(false);

    if (result.error) {
      Toast.show({ type: 'error', text1: result.error });
      return;
    }

    setStep('otp');
    setCountdown(60);
  };

  const handleOtpChange = (value: string, index: number) => {
    const newOtpValues = [...otpValues];

    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newOtpValues[i] = digits[i] || '';
      }
      setOtpValues(newOtpValues);

      const nextIndex = Math.min(digits.length, 5);
      otpRefs.current[nextIndex]?.focus();

      if (digits.length === 6) {
        handleVerifyOtp(digits.join(''));
      }
      return;
    }

    newOtpValues[index] = value;
    setOtpValues(newOtpValues);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    const otpCode = newOtpValues.join('');
    if (otpCode.length === 6) {
      handleVerifyOtp(otpCode);
    }
  };

  const handleVerifyOtp = async (otpCode: string) => {
    setLoading(true);
    const result = await verifyOtp(phone, otpCode);
    setLoading(false);

    if (result.error) {
      Toast.show({ type: 'error', text1: '验证码错误或已过期，请重试或重新获取' });
      setOtpValues(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
      return;
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    await handleSendOtp();
  };

  // 测试阶段专用：跳过登录，直接以游客身份进入
  const handleSkipLogin = async () => {
    setGuestLoading(true);
    const result = await signInAsGuest();
    setGuestLoading(false);
    if (result.error) {
      Toast.show({ type: 'error', text1: result.error });
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* App Icon & Name */}
          <View style={styles.header}>
            <Image
              source={{ uri: APP_ICON }}
              style={styles.appIcon}
              defaultSource={require('@/assets/images/icon.png')}
            />
            <Text style={styles.appName}>{APP_NAME}</Text>
            <Text style={styles.subtitle}>陪伴宝贝成长的智能小伙伴</Text>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            {step === 'phone' ? (
              <>
                <View style={styles.phoneInputContainer}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>+86</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="请输入手机号"
                    placeholderTextColor="#8B87A0"
                    keyboardType="phone-pad"
                    maxLength={11}
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, (!phone || loading) && styles.disabledButton]}
                  onPress={handleSendOtp}
                  disabled={!phone || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>获取验证码</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.otpTitle}>输入验证码</Text>
                <Text style={styles.otpSubtitle}>已发送至 +86 {phone}</Text>

                <View style={styles.otpContainer}>
                  {otpValues.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => { otpRefs.current[index] = ref; }}
                      style={styles.otpInput}
                      placeholder="·"
                      placeholderTextColor="#C5C0DB"
                      keyboardType="number-pad"
                      maxLength={1}
                      value={digit}
                      onChangeText={(value) => handleOtpChange(value, index)}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.resendButton, countdown > 0 && styles.disabledButton]}
                  onPress={handleResendOtp}
                  disabled={countdown > 0}
                >
                  <Text style={styles.resendButtonText}>
                    {countdown > 0 ? `${countdown}s 后重新发送` : '重新发送验证码'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => {
                    setStep('phone');
                    setOtpValues(['', '', '', '', '', '']);
                  }}
                >
                  <Text style={styles.backButtonText}>更换手机号</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* 测试阶段：跳过登录 */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipLogin}
            disabled={guestLoading}
          >
            {guestLoading ? (
              <ActivityIndicator size="small" color="#8B87A0" />
            ) : (
              <Text style={styles.skipButtonText}>跳过登录，直接体验（测试）</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  appIcon: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2D2B3D',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8B87A0',
    marginTop: 8,
  },
  formContainer: {
    gap: 16,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(124,92,252,0.15)',
    paddingHorizontal: 16,
    height: 56,
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  countryCode: {
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: '#EDE8FF',
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D2B3D',
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2D2B3D',
    paddingLeft: 12,
    height: '100%',
  },
  primaryButton: {
    backgroundColor: '#7C5CFC',
    borderRadius: 20,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#5A3ED9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.5,
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B87A0',
    textDecorationLine: 'underline',
  },
  otpTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2D2B3D',
    textAlign: 'center',
  },
  otpSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8B87A0',
    textAlign: 'center',
    marginTop: 4,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 24,
  },
  otpInput: {
    width: 46,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EDE8FF',
    fontSize: 22,
    fontWeight: '800',
    color: '#2D2B3D',
    textAlign: 'center',
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  resendButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C5CFC',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B87A0',
  },
});
