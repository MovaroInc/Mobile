import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared/hooks/useTheme';
import tw, { style } from 'twrnc';
import AuthInput from '../../shared/components/inputs/AuthInput';
import AuthBotton from '../../shared/components/buttons/AuthBotton';
import SecondaryAuthButton from '../../shared/components/buttons/SecondaryAuthButton';
import { supabase } from '../../shared/lib/supabase';
import { useNavigation } from '@react-navigation/native';
import Config from 'react-native-config';
import axios from 'axios';
import { api } from '../../shared/lib/api';
import { useSession } from '../../state/useSession';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storeNotificationToken } from '../../shared/lib/notifications';
const LoginScreen = () => {
  const { colors } = useTheme(); // colors.bg, colors.text, colors.brand.primary, etc.
  const navigation = useNavigation();
  const { setUserId } = useSession();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const handleLogin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const code = (error as any)?.code;
        const isUnverified = code === 'email_not_confirmed';

        const title = isUnverified ? 'Email not verified' : 'Login failed';
        const message = isUnverified
          ? 'Please verify your email before logging in.'
          : error.message || 'Invalid email or password.';

        const buttons = isUnverified
          ? [
              { text: 'Resend', onPress: handleResendEmailVerification },
              { text: 'OK' },
            ]
          : [{ text: 'OK' }];

        Alert.alert(title, message, buttons);
        return;
      }
      setUserId({ userId: data.user.id });
    } catch (e: any) {
      console.log('Login error:', e);
      Alert.alert('Login failed', e.message || 'Unexpected response.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmailVerification = async () => {
    try {
      const { success, data, message, code } = await api.post<{
        success: boolean;
        data: any | null;
        error: any | null;
        message: string | null;
      }>('/users/send-email-verification', {
        email,
      });
      if (!success) {
        Alert.alert(
          'Resend email verification failed',
          message || 'Unexpected response.',
        );
        return;
      }
      Alert.alert(
        'Email verification sent',
        message || 'Email verification sent.',
      );
    } catch (e: any) {
      console.log('Resend email verification error:', e);
    }
  };

  const handleLearnMore = () => {
    // Optional: Alert first
    Alert.alert(
      'Open movaroinc.app',
      'You will be redirected to your browser to learn more about what Movaro can do for your business.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Continue',
          onPress: () => {
            Linking.openURL('https://movaro-web-g4bx.onrender.com');
          },
        },
      ],
    );
  };
  const handleRedirectDriver = async () => {
    navigation.navigate('DriverSignup');
  };

  const handleRedirectAdmin = async () => {
    navigation.navigate('SignupBusinessAccount');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Split screen: top content + bottom footer */}
      <View style={tw`flex-1 justify-between`}>
        {/* TOP CONTENT (no flex-1 here so it stays at the top) */}
        <View style={tw`w-full items-center`}>
          {/* Accent bar */}
          <View
            style={[
              tw`w-1/4 h-2 rounded-full mt-2`,
              { backgroundColor: colors.brand.primary },
            ]}
          />

          {/* Title */}
          <Text
            style={[tw`mt-6 text-4xl font-semibold`, { color: colors.text }]}
          >
            Movaro
          </Text>
          <Text style={[tw`mt-1 text-base`, { color: colors.text }]}>
            Smarter Routes. Simpler Logistics.
          </Text>

          {/* Inputs */}
          <View
            style={[
              tw`w-11/12 mt-8 rounded-2xl border`,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <AuthInput
              value={email}
              onChangeText={setEmail}
              secureTextEntry={false}
              placeholder="Email"
              icon="Mail"
              showSecure={false}
              toggleSecure={() => setShowPassword(!showPassword)}
              keyboardType="email-address"
              autoCapitalize="none"
              isValid={true}
            />
            <AuthInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={showPassword}
              placeholder="Password"
              icon="Lock"
              showSecure={true}
              toggleSecure={() => setShowPassword(!showPassword)}
              isValid={true}
            />
          </View>

          {/* Forgot + CTA */}
          <View style={tw`w-11/12 items-end mt-3`}>
            <TouchableOpacity onPress={() => {}}>
              <Text style={[tw`text-sm mr-2`, { color: colors.text }]}>
                Forgot Password?
              </Text>
            </TouchableOpacity>
          </View>

          <View style={tw`w-11/12`}>
            <AuthBotton label="Login" loading={loading} onPress={handleLogin} />
          </View>

          {/* Divider */}
          <View style={tw`w-8/12 flex-row items-center justify-between mt-4`}>
            <View
              style={[
                tw`w-1/3 h-[1px] rounded-full`,
                { backgroundColor: colors.border },
              ]}
            />
            <Text style={[tw`text-sm`, { color: colors.text }]}>OR</Text>
            <View
              style={[
                tw`w-1/3 h-[1px] rounded-full`,
                { backgroundColor: colors.border },
              ]}
            />
          </View>

          {/* Secondary actions */}
          <View>
            <SecondaryAuthButton
              label="Signup as Business"
              loading={false}
              onPress={handleRedirectAdmin}
            />
            <SecondaryAuthButton
              label="Register as Driver"
              loading={false}
              onPress={handleRedirectDriver}
            />
          </View>
        </View>

        {/* BOTTOM FOOTER (pinned to bottom by justify-between) */}
        <View style={tw`px-6 pb-4`}>
          <Text style={[tw`text-xs text-center`, { color: colors.text }]}>
            By continuing, you agree to Movaro Inc. Terms of Service.
          </Text>
        </View>
      </View>
    </View>
  );
};

export default LoginScreen;
