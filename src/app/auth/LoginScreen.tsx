import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared/hooks/useTheme';
import tw from 'twrnc';
import AuthInput from '../../shared/components/inputs/AuthInput';
import AuthBotton from '../../shared/components/buttons/AuthBotton';
import SecondaryAuthButton from '../../shared/components/buttons/SecondaryAuthButton';
import { supabase } from '../../shared/lib/supabase';
import { useNavigation } from '@react-navigation/native';
import Config from 'react-native-config';
import axios from 'axios';
import { api } from '../../shared/lib/api';
import { useSession } from '../../state/useSession';
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

      console.log('login data', data);
      console.log('loginerror', error);

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

  const handleRedirectBusiness = async () => {
    navigation.navigate('SignupBusinessAccount');
  };

  const handleRedirectDriver = async () => {
    navigation.navigate('DriverSignup');
  };

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      <View style={tw`flex-1 items-center justify-between`}>
        {/* Accent bar */}
        <View style={tw`w-full flex-1 items-center justify-start`}>
          <View
            style={[
              tw`w-1/3 h-2 mt-6 rounded-full`,
              { backgroundColor: colors.brand.primary },
            ]}
          />

          {/* Title */}
          <Text
            style={[
              tw`mt-8 text-4xl font-semibold`,
              { color: colors.text }, // <-- set text color, not background
            ]}
          >
            Movaro
          </Text>
          <Text
            style={[
              tw`mt-1 text-base`,
              { color: colors.text }, // <-- set text color, not background
            ]}
          >
            Smarter Routes. Simpler Logistics.
          </Text>
          <View
            style={[
              tw`w-11/12 rounded-3 mt-8 border`,
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
          <View style={tw`w-11/12 flex items-end mt-3`}>
            <TouchableOpacity onPress={() => {}}>
              <Text style={[tw`text-sm mr-2`, { color: colors.text }]}>
                Forgot Password?
              </Text>
            </TouchableOpacity>
          </View>
          <View style={tw`w-11/12`}>
            <AuthBotton label="Login" loading={loading} onPress={handleLogin} />
          </View>
          <View style={tw`w-8/12 flex-row items-center justify-between mt-4`}>
            <View
              style={[
                tw`w-1/3 h-.5 rounded-full`,
                { backgroundColor: colors.border },
              ]}
            />
            <View>
              <Text style={[tw`text-sm`, { color: colors.text }]}>OR</Text>
            </View>
            <View
              style={[
                tw`w-1/3 h-.5 rounded-full`,
                { backgroundColor: colors.border },
              ]}
            />
          </View>
          <View>
            <SecondaryAuthButton
              label="Signup as Business"
              loading={false}
              onPress={handleRedirectBusiness}
            />
            <SecondaryAuthButton
              label="Signup as Driver"
              loading={false}
              onPress={() => {}}
            />
          </View>
        </View>
        <View
          style={tw`w-8/12 flex-row items-center justify-between mt-4 mb-4`}
        >
          <Text style={[tw`text-xs text-center`, { color: colors.text }]}>
            By continuing, you agree to Movaro Inc. Terms of Service and Privacy
            Policy.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default LoginScreen;
