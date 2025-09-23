import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  Alert,
  TouchableOpacity,
  AppState,
  Linking,
} from 'react-native';
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
import {
  ensureLocationPermission,
  requestLocation,
} from '../../shared/lib/locations';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
const ValidateLocationScreen = () => {
  const { colors } = useTheme(); // colors.bg, colors.text, colors.brand.primary, etc.
  const navigation = useNavigation();

  const [granted, setGranted] = useState<boolean | null>(false);
  const [requested, setRequested] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    checkLocation();
  }, []);

  const checkLocation = async () => {
    setLoading(true);
    const geo_success = (position: any) => {
      console.log('geo_success', position);
      setGranted(true);
      setLoading(false);
    };
    const geo_error = (error: any) => {
      console.log('geo_error', error);
      setGranted(false);
      setLoading(false);
    };
    const geo_options = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 1000,
    };
    await Geolocation.getCurrentPosition(geo_success, geo_error, geo_options);
    setLoading(false);
  };

  const handleRequestNotifications = async () => {
    Alert.alert('Requesting Location', 'Please enable location services.', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Settings',
        onPress: () => {
          openSettingsAndWait();
          setRequested(true);
        },
      },
    ]);
  };

  async function openSettingsAndWait(): Promise<void> {
    await Linking.openSettings();

    await new Promise<void>(resolve => {
      const sub = AppState.addEventListener('change', state => {
        if (state === 'active') {
          sub.remove();
          resolve();
        }
      });
    });
  }

  const onContinuePress = async () => {
    if (!granted) {
      Alert.alert('Missing Requirements', 'Please enable notifications');
      return;
    }
    await AsyncStorage.setItem('locationGranted', 'true');
    navigation.navigate('AcceptingLegal');
  };

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      <View style={tw`flex-1 items-center`}>
        {/* Accent bar */}
        <View
          style={[
            tw`w-1/3 h-2 mt-6 rounded-full`,
            { backgroundColor: colors.brand.primary },
          ]}
        />

        <View style={tw`mt-4`}>
          <Text style={[tw`text-2xl font-semibold`, { color: colors.text }]}>
            Signup
          </Text>
        </View>

        <View style={tw`w-11/12 mt-4`}>
          <Text style={[tw`text-xl`, { color: colors.text }]}>
            Enable Location
          </Text>
        </View>
        <View style={tw`w-11/12 mt-4`}>
          <Text style={[tw`text-xs`, { color: colors.text }]}>
            Let Movaro access your location to optimize routes and improve
            on-shift visibility.
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
              Accurate ETAs and route adjustments
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
              On-shift location for safety & coordination
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
              Clock-in geofencing and stop verification
            </Text>
          </View>
        </View>

        {/* CTA */}
        <View style={tw`w-11/12 mt-4`}>
          <AuthStaticButton
            label={
              granted
                ? 'Location Enabled'
                : requested
                ? 'Checking Location'
                : 'Enable Location'
            }
            onPress={
              granted
                ? () => {}
                : requested
                ? checkLocation
                : handleRequestNotifications
            }
            loading={loading}
            color={
              granted
                ? '#16A34A'
                : requested
                ? '#FFD700'
                : colors.brand.secondary
            }
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

        {/* Back */}
        <View style={tw`mt-4 flex-row items-center justify-center`}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={tw`ml-2`}
          >
            <Text style={tw`text-sm font-bold text-sky-600`}>Back</Text>
          </TouchableOpacity>
        </View>

        {/* Footer note */}
        <View style={tw`w-11/12 mt-auto mb-6`}>
          <Text style={[tw`text-xs text-center`, { color: colors.muted }]}>
            You can change this anytime in Settings. Movaro uses location only
            for business operations while you’re on shift.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ValidateLocationScreen;
