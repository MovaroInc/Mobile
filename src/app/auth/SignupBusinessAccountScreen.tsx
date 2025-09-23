import React, { useLayoutEffect, useState } from 'react';
import { View, Text, Image, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared/hooks/useTheme';
import tw from 'twrnc';
import AuthInput from '../../shared/components/inputs/AuthInput';
import AuthBotton from '../../shared/components/buttons/AuthBotton';
import { useNavigation } from '@react-navigation/native';
import Logo from '../../shared/assets/m2logo-blue.png';
import {
  validateEmailFormat,
  validatePasswordFormat,
  validateUsernameField,
  validateVerifyPasswordField,
} from '../../shared/lib/validators';
import { validateEmailField } from '../../shared/lib/validators';
import AsyncStorage from '@react-native-async-storage/async-storage';
const SignupBusinessAccountScreen = () => {
  const { colors } = useTheme(); // colors.bg, colors.text, colors.brand.primary, etc.
  const navigation = useNavigation();

  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [verifyPassword, setVerifyPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(true);
  const [showVerifyPassword, setShowVerifyPassword] = useState<boolean>(true);

  const [validUsername, setValidUsername] = useState<boolean>(true);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [validEmail, setValidEmail] = useState<boolean>(true);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [validPassword, setValidPassword] = useState<boolean>(true);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [validVerifyPassword, setValidVerifyPassword] = useState<boolean>(true);
  const [verifyPasswordError, setVerifyPasswordError] = useState<string | null>(
    null,
  );

  useLayoutEffect(() => {
    const initialized = async () => {
      const storedEmail = await AsyncStorage.getItem('email');
      setEmail(storedEmail || '');
      const storedPassword = await AsyncStorage.getItem('password');
      setPassword(storedPassword || '');
      const storedVerifyPassword = await AsyncStorage.getItem('verifyPassword');
      setVerifyPassword(storedVerifyPassword || '');
      const storedUsername = await AsyncStorage.getItem('username');
      setUsername(storedUsername || '');
    };
    initialized();
  }, []);

  const onEmailChange = async (v: string) => {
    setEmail(v.trim().toLowerCase());
    const err = await validateEmailField(v);
    console.log('err', err);
    setValidEmail(err.valid);
    setEmailError(err.error);
  };

  const onPasswordChange = async (v: string) => {
    setPassword(v);
    const err = validatePasswordFormat(v);
    console.log('err', err);
    setValidPassword(err.valid);
    setPasswordError(err.error);
  };

  const onVerifyPasswordChange = async (v: string) => {
    setVerifyPassword(v);
    const err = validateVerifyPasswordField(password, v);
    console.log('err', err.error);
    setVerifyPasswordError(err.error);
    setValidVerifyPassword(err.valid);
  };

  const onUsernameChange = async (v: string) => {
    setUsername(v.trim().toLowerCase());
    const err = await validateUsernameField(v);
    console.log('err', err);
    setValidUsername(err.valid);
    setUsernameError(err.error);
  };

  const onContinuePress = async () => {
    if (
      !validUsername ||
      !validEmail ||
      email.length < 4 ||
      !validPassword ||
      password.length < 4 ||
      !validVerifyPassword ||
      verifyPassword.length < 4
    ) {
      Alert.alert('Setup Failed', 'There are issues with your credentials');
      return;
    } else {
      await AsyncStorage.setItem('email', email);
      await AsyncStorage.setItem('password', password);
      await AsyncStorage.setItem('verifyPassword', verifyPassword);
      await AsyncStorage.setItem('username', username);
      navigation.navigate('SignupBusinessProfile');
    }
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
          {/* <Image source={Logo} style={tw`w-14 h-14 mt-8`} /> */}
          <View style={tw`mt-4`}>
            <Text style={[tw`text-2xl font-semibold`, { color: colors.text }]}>
              Signup
            </Text>
          </View>
          <View style={tw`w-11/12 mt-4`}>
            <Text style={[tw`text-xl`, { color: colors.text }]}>
              Account Details
            </Text>
          </View>
          <View
            style={[
              tw`w-11/12 rounded-3 mt-4 border`,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <AuthInput
              value={email}
              onChangeText={onEmailChange}
              secureTextEntry={false}
              placeholder="Email"
              icon="Mail"
              showSecure={false}
              toggleSecure={() => {}}
              isValid={validEmail}
              required={true}
              message={emailError}
            />
            <AuthInput
              value={password}
              onChangeText={onPasswordChange}
              secureTextEntry={showPassword}
              placeholder="Password"
              icon="Lock"
              showSecure={true}
              toggleSecure={() => setShowPassword(!showPassword)}
              isValid={validPassword}
              required={true}
              message={passwordError}
            />
            <AuthInput
              value={verifyPassword}
              onChangeText={onVerifyPasswordChange}
              secureTextEntry={showVerifyPassword}
              placeholder="Verify Password"
              icon="Lock"
              showSecure={true}
              toggleSecure={() => setShowVerifyPassword(!showVerifyPassword)}
              isValid={validVerifyPassword}
              required={true}
              message={verifyPasswordError}
            />
            <AuthInput
              value={username}
              onChangeText={onUsernameChange}
              secureTextEntry={false}
              placeholder="Username"
              icon="User"
              showSecure={false}
              toggleSecure={() => {}}
              isValid={validUsername}
              required={false}
              message={usernameError}
            />
          </View>
          <View style={tw`mt-4 w-11/12`}>
            <AuthBotton
              label="Continue Signup"
              loading={false}
              onPress={onContinuePress}
            />
          </View>
          <View style={tw`mt-8 flex-row items-center justify-center`}>
            <Text style={[tw`text-sm`, { color: colors.text }]}>
              Have an account?
            </Text>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={tw`ml-2`}
            >
              <Text style={[tw`text-sm font-bold text-sky-600`]}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SignupBusinessAccountScreen;
