import React, { useLayoutEffect, useState } from 'react';
import { View, Text, Image, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared/hooks/useTheme';
import tw from 'twrnc';
import AuthInput from '../../shared/components/inputs/AuthInput';
import AuthBotton from '../../shared/components/buttons/AuthBotton';
import { useNavigation } from '@react-navigation/native';
import {
  formatPhoneUS,
  isPhoneUSDashed,
} from '../../shared/utils/FormatPhoneNumber';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toE164US } from '../../shared/utils/phone';
const SignupBusinessProfileScreen = () => {
  const { colors } = useTheme(); // colors.bg, colors.text, colors.brand.primary, etc.
  const navigation = useNavigation();

  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [profilePicture, setProfilePicture] = useState<string>('');

  useLayoutEffect(() => {
    const initialized = async () => {
      const storedFirstName = await AsyncStorage.getItem('firstName');
      setFirstName(storedFirstName || '');
      const storedLastName = await AsyncStorage.getItem('lastName');
      setLastName(storedLastName || '');
      const storedPhone = await AsyncStorage.getItem('phone');
      setPhone(storedPhone || '');
    };
    initialized();
  }, []);

  const handleFirstNameChange = async (v: string) => {
    setFirstName(v);
  };

  const handleLastNameChange = async (v: string) => {
    setLastName(v);
  };

  const onContinuePress = async () => {
    if (firstName === '' || lastName === '' || phone === '') {
      Alert.alert('Missing Requirements', 'Please fill in all fields');
      return;
    }
    if (!isPhoneUSDashed(phone)) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid phone number');
      return;
    }
    await AsyncStorage.setItem('firstName', firstName);
    await AsyncStorage.setItem('lastName', lastName);
    await AsyncStorage.setItem('phone', toE164US(phone.toString()));
    navigation.navigate('SignupBusiness');
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
              Profile Info
            </Text>
          </View>
          <View
            style={[
              tw`w-11/12 rounded-3 mt-4 border`,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <View style={tw`flex-row items-center justify-between`}>
              <View style={tw`w-[48%]`}>
                <AuthInput
                  value={firstName}
                  onChangeText={handleFirstNameChange}
                  secureTextEntry={false}
                  placeholder="First Name"
                  icon="User"
                  showSecure={false}
                  toggleSecure={() => {}}
                  isValid={true}
                  required={true}
                  message={null}
                />
              </View>
              <View style={tw`w-[48%]`}>
                <AuthInput
                  value={lastName}
                  onChangeText={handleLastNameChange}
                  secureTextEntry={false}
                  placeholder="Last Name"
                  icon="User"
                  showSecure={false}
                  toggleSecure={() => {}}
                  isValid={true}
                  required={true}
                  message={null}
                />
              </View>
            </View>
            <AuthInput
              value={phone}
              onChangeText={t => setPhone(formatPhoneUS(t))}
              secureTextEntry={false}
              placeholder="Phone Number"
              icon="Phone"
              showSecure={false}
              toggleSecure={() => {}}
              isValid={true}
              required={true}
              message={null}
              keyboardType="phone-pad"
            />
          </View>
          <View style={tw`mt-4 w-11/12`}>
            <AuthBotton
              label="Setup Business Profile"
              loading={false}
              onPress={onContinuePress}
            />
          </View>
          <View style={tw`mt-8 flex-row items-center justify-center`}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={tw`ml-2`}
            >
              <Text style={[tw`text-sm font-bold text-sky-600`]}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SignupBusinessProfileScreen;
