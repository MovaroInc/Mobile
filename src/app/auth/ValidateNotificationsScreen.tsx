import React, { useEffect, useState } from 'react';
import { View, Text, Image, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared/hooks/useTheme';
import tw from 'twrnc';
import AuthBotton from '../../shared/components/buttons/AuthBotton';
import { useNavigation } from '@react-navigation/native';
import SecondaryAuthButton from '../../shared/components/buttons/SecondaryAuthButton';
import AuthStaticButton from '../../shared/components/buttons/AuthStaticButton';
import {
  checkIOSPermissions,
  requestNotificationPermission,
} from '../../shared/lib/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
const ValidateNotificationsScreen = () => {
  const { colors } = useTheme(); // colors.bg, colors.text, colors.brand.primary, etc.
  const navigation = useNavigation();

  const [granted, setGranted] = useState<boolean | null>(null);

  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    checkNotifications();
  }, []);

  const checkNotifications = async () => {
    const notGranted = await checkIOSPermissions();
    console.log('notGranted', notGranted);
    setLoading(false);
  };

  const handleRequestNotifications = async () => {
    const iosGranted = await requestNotificationPermission();
    setGranted(iosGranted);
    setLoading(false);
  };

  const onContinuePress = async () => {
    if (!granted) {
      Alert.alert('Missing Requirements', 'Please enable notifications');
      return;
    }
    await AsyncStorage.setItem('notificationsGranted', 'true');
    navigation.navigate('ValidateLocation');
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
              Enable Notifications
            </Text>
          </View>
          <View style={tw`w-11/12 mt-4`}>
            <Text style={[tw`text-xs`, { color: colors.text }]}>
              Stay up do date with everything going on with your business and
              receive notifications for important events.
            </Text>
          </View>
          <View style={tw`w-11/12 mt-4`}>
            <View style={tw`flex-row items-start mb-2`}>
              <View
                style={[
                  tw`w-2 h-2 mt-2 rounded-full`,
                  { backgroundColor: colors.brand.primary },
                ]}
              />
              <Text style={[tw`ml-3 text-xs`, { color: colors.text }]}>
                Real-time updates on driver time sheets
              </Text>
            </View>
            <View style={tw`flex-row items-start mb-2`}>
              <View
                style={[
                  tw`w-2 h-2 mt-2 rounded-full`,
                  { backgroundColor: colors.brand.primary },
                ]}
              />
              <Text style={[tw`ml-3 text-xs`, { color: colors.text }]}>
                Real-time updates on driver stops and route changes
              </Text>
            </View>
            <View style={tw`flex-row items-start`}>
              <View
                style={[
                  tw`w-2 h-2 mt-2 rounded-full`,
                  { backgroundColor: colors.brand.primary },
                ]}
              />
              <Text style={[tw`ml-3 text-xs`, { color: colors.text }]}>
                Business announcements and safety notices
              </Text>
            </View>
          </View>
          <View style={tw`w-11/12 mt-4`}>
            <AuthStaticButton
              label={granted ? 'Notifications Enabled' : 'Enable Notifications'}
              onPress={granted ? () => {} : handleRequestNotifications}
              loading={loading}
              color={granted ? '#00a63e' : colors.brand.secondary}
              valid={granted || false}
            />
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
          <View style={tw`w-11/12 mt-auto mb-6`}>
            <Text style={[tw`text-xs text-center`, { color: colors.muted }]}>
              You can change this anytime in Settings. Movaro uses location only
              for business operations while you’re on shift.
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ValidateNotificationsScreen;
