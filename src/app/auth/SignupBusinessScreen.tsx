import React, { useLayoutEffect, useState } from 'react';
import { View, Text, Image, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared/hooks/useTheme';
import tw from 'twrnc';
import AuthInput from '../../shared/components/inputs/AuthInput';
import AuthBotton from '../../shared/components/buttons/AuthBotton';
import { useNavigation } from '@react-navigation/native';
import { formatPhoneUS } from '../../shared/utils/FormatPhoneNumber';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Config from 'react-native-config';
const SignupBusinessScreen = () => {
  const { colors } = useTheme(); // colors.bg, colors.text, colors.brand.primary, etc.
  const navigation = useNavigation();

  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [industry, setIndustry] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);

  const [suggestions, setSuggestions] = useState<any[]>([]);

  useLayoutEffect(() => {
    const initialized = async () => {
      const storedName = await AsyncStorage.getItem('businessName');
      setName(storedName || '');
      const storedPhone = await AsyncStorage.getItem('businessPhone');
      setPhone(storedPhone || '');
      const storedIndustry = await AsyncStorage.getItem('businessIndustry');
      setIndustry(storedIndustry || '');
      const storedAddress = await AsyncStorage.getItem('businessAddress');
      setAddress(storedAddress || '');
      const storedLatitude = await AsyncStorage.getItem('businessLatitude');
      setLatitude(parseFloat(storedLatitude || '0'));
      const storedLongitude = await AsyncStorage.getItem('businessLongitude');
      setLongitude(parseFloat(storedLongitude || '0'));
    };
    initialized();
  }, []);

  const handleSearchAddress = async (text: string) => {
    setAddress(text);

    if (text.length < 3) {
      setSuggestions([]);
      return;
    }

    const options = {
      method: 'GET',
      url: 'https://google-place-autocomplete-and-place-info.p.rapidapi.com/maps/api/place/autocomplete/json',
      params: { input: text },
      headers: {
        'x-rapidapi-key': Config.GOOGLE_API_KEY,
        'x-rapidapi-host': Config.GOOGLE_API_HOST,
      },
    };

    try {
      const response = await axios.request(options);
      const predictions = response.data?.predictions || [];
      setSuggestions(predictions);
    } catch (error) {
      console.error(error);
      Alert.alert('Error searching business addresses.');
    }
  };

  const getPlaceCoordinates = async (text: string) => {
    const options = {
      method: 'GET',
      url: 'https://google-maps-geocoding3.p.rapidapi.com/geocode',
      params: {
        address: text,
      },
      headers: {
        'x-rapidapi-key': Config.GOOGLE_API_KEY,
        'x-rapidapi-host': Config.GOOGLE_API_HOST,
      },
    };
    const customerPosition = await axios.request(options);
    console.log(customerPosition);
    setLatitude(parseFloat(customerPosition.data.latitude));
    setLongitude(parseFloat(customerPosition.data.longitude));
  };

  const ensureCoords = async (addr: string, retries = 4, delayMs = 600) => {
    const haveCoords = () =>
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude !== 0 &&
      longitude !== 0;

    if (haveCoords()) return true;

    for (let i = 0; i <= retries; i++) {
      const ok = await getPlaceCoordinates(addr);
      if (ok || haveCoords()) return true;
      await new Promise(r => setTimeout(r, delayMs));
    }
    return false;
  };

  const onContinuePress = async () => {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      Alert.alert('Missing Requirements', 'Please fill in all fields');
      return;
    }

    const ok = await ensureCoords(address);
    if (!ok) {
      Alert.alert(
        'Location not found',
        'Please select an address from suggestions or try again.',
      );
      return;
    }

    await AsyncStorage.setItem('businessName', name.trim());
    await AsyncStorage.setItem('businessPhone', phone.trim());
    await AsyncStorage.setItem('businessIndustry', industry.trim());
    await AsyncStorage.setItem('businessAddress', address.trim());
    await AsyncStorage.setItem('businessLatitude', String(latitude));
    await AsyncStorage.setItem('businessLongitude', String(longitude));

    navigation.navigate('ValidateNotifications');
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
              Business Details
            </Text>
          </View>
          <View
            style={[
              tw`w-11/12 rounded-3 mt-4 border`,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <AuthInput
              value={name}
              onChangeText={setName}
              secureTextEntry={false}
              placeholder="Name"
              icon="User"
              showSecure={false}
              toggleSecure={() => {}}
              isValid={true}
              required={true}
              message={null}
            />
            <AuthInput
              value={phone}
              onChangeText={t => setPhone(formatPhoneUS(t))}
              secureTextEntry={false}
              placeholder="Phone"
              icon="Phone"
              showSecure={false}
              toggleSecure={() => {}}
              isValid={true}
              required={true}
              message={null}
              keyboardType="phone-pad"
            />
            <AuthInput
              value={industry}
              onChangeText={setIndustry}
              secureTextEntry={false}
              placeholder="Industry"
              icon="Briefcase"
              showSecure={false}
              toggleSecure={() => {}}
              isValid={true}
              required={false}
              message={null}
            />
            <AuthInput
              value={address}
              onChangeText={handleSearchAddress}
              secureTextEntry={false}
              placeholder="Address"
              icon="Map"
              showSecure={false}
              toggleSecure={() => {}}
              isValid={true}
              required={true}
              message={null}
            />
            <View style={tw`w-full max-h-33 overflow-hidden`}>
              {suggestions.map(suggestion => (
                <TouchableOpacity
                  key={suggestion.place_id}
                  onPress={() => {
                    setAddress(suggestion.description);
                    setSuggestions([]);
                    getPlaceCoordinates(suggestion.description);
                  }}
                  style={[
                    tw`w-full p-2 border-b`,
                    { borderColor: colors.border },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[tw`text-sm p-1`, { color: colors.text }]}
                  >
                    {suggestion.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={tw`mt-4 w-11/12`}>
            <AuthBotton
              label="Continue Signup"
              loading={false}
              onPress={onContinuePress}
            />
          </View>
          <View style={tw`mt-4 flex-row items-center justify-center`}>
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

export default SignupBusinessScreen;
