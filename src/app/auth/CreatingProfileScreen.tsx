import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import tw from 'twrnc';
import * as Feather from 'react-native-feather';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../shared/hooks/useTheme';
import AuthBotton from '../../shared/components/buttons/AuthBotton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createBusinessAccount,
  createCustomerAccount,
  createEmployeeAccount,
  createUserAccount,
  updateProfileAndBusiness,
} from '../../shared/lib/authHelpers';

// 1. Import necessary location utilities from the shared library
import {
  getOneFix, // Function to get the current fixed position
  ensureForegroundOrPrompt, // Function to check/request permission
  openAppSettings, // Function to open settings from the utility file
} from '../../shared/lib/locations';

import StepRow from '../../shared/components/info/StepRow';
import { toE164US } from '../../shared/utils/phone';
import { storeNotificationToken } from '../../shared/lib/notifications';

const CreatingProfileScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const [user, setUser] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);

  const [location, setLocation] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({ latitude: null, longitude: null });

  const [stepDone, setStepDone] = useState({
    creatingProfile: false,
    creatingBusiness: false,
    creatingEmployee: false,
    creatingCustomer: false,
    sendingEmail: false,
    verifyingEmail: false,
    finishingUp: false,
  });

  const [processing, setProcessing] = useState({
    creatingProfile: false,
    creatingBusiness: false,
    creatingEmployee: false,
    creatingCustomer: false,
    sendingEmail: false,
    verifyingEmail: false,
    finishingUp: false,
  });

  const [errors, setErrors] = useState({
    creatingProfile: null,
    creatingBusiness: null,
    creatingEmployee: null,
    creatingCustomer: null,
    sendingEmail: null,
    verifyingEmail: null,
    finishingUp: null,
  });

  // Function to handle the location permission and fetching process
  const handleLocationAndCreate = async () => {
    // We use the 'creatingProfile' state slice to represent the initial location fetching phase
    setProcessing(ps => ({ ...ps, creatingProfile: true }));
    setErrors(es => ({ ...es, creatingProfile: null }));

    try {
      // 1. Ensure location permission is granted (prompts user if needed)
      const permissionLevel = await ensureForegroundOrPrompt();

      if (!permissionLevel.authorized) {
        // Permission denied (either by user or OS)
        setErrors(es => ({
          ...es,
          creatingProfile: 'Location permission required.',
        }));

        Alert.alert(
          'Location Access Required',
          'Movaro needs location access to create your profile and set your initial business location. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: openAppSettings },
          ],
          { cancelable: false },
        );
        return;
      }

      // 2. Grab the current fixed location
      const result = await getOneFix();

      if (!result.ok) {
        // Location fetch failed (e.g., GPS is off, device error)
        throw new Error(
          result.errorMessage || 'Failed to get current location from GPS.',
        );
      }

      // 3. Success: Set location state. This triggers the next useEffect to start createAccounts.
      setLocation({
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      });

      // Mark the location phase as done
      setStepDone(sd => ({ ...sd, creatingProfile: true }));
      setProcessing(ps => ({ ...ps, creatingProfile: false }));
    } catch (error: any) {
      const message =
        error.message || 'An unknown error occurred while setting location.';

      setErrors(es => ({ ...es, creatingProfile: message }));
      setProcessing(ps => ({ ...ps, creatingProfile: false }));

      if (!message.includes('Permission denied')) {
        // Show general error if it wasn't a permission issue (e.g., GPS off)
        Alert.alert(
          'Location Error',
          'Could not determine your current location. Please ensure your device GPS is enabled and try again.',
          [{ text: 'OK' }],
        );
      }
    }
  };

  useLayoutEffect(() => {
    // Start the location process immediately when the screen mounts
    handleLocationAndCreate();
  }, []); // Run once on mount

  useEffect(() => {
    // This effect runs once the location state has been successfully set
    if (location.longitude !== null && location.latitude !== null) {
      createAccounts();
    }
  }, [location]);

  const createAccounts = async () => {
    try {
      const createdProfile = await createProfile(); // returns the new user object
      const createdBusiness = await createBusiness(); // returns the new business object
      const createdEmployee = await createEmployee(
        createdBusiness,
        createdProfile,
      );
      const createdCustomer = await createCustomer(
        createdBusiness,
        createdProfile,
      );
      await FinishingUp(
        createdBusiness,
        createdProfile,
        createdEmployee,
        createdCustomer,
      );
      await createDevice(createdProfile);
      await sendEmail();
    } catch (error) {
      console.error(error);
    }
  };

  const createDevice = async (createdProfile: any) => {
    const token = await AsyncStorage.getItem('@apns_device_token');
    if (createdProfile.id) {
      const payload = {
        apns_token: token,
        platform: 'ios',
        apns_env: 'production',
        device_model: Platform.select({
          ios: 'iPhone',
          android: 'Android',
        }),
        os_version: Platform.OS,
        profile_id: createdProfile.id,
      };
      await storeNotificationToken(payload);
    }
    return true;
  };

  const createProfile = async () => {
    // Re-set processing state for the actual network creation step
    setProcessing(ps => ({ ...ps, creatingProfile: true }));
    setStepDone(sd => ({ ...sd, creatingProfile: false }));

    const email = await AsyncStorage.getItem('email');
    const password = await AsyncStorage.getItem('password');
    const username = await AsyncStorage.getItem('username');
    const firstName = await AsyncStorage.getItem('firstName');
    const lastName = await AsyncStorage.getItem('lastName');
    const phone = await AsyncStorage.getItem('phone');
    const phoneE164 = toE164US(phone || '');
    const { data } = await createUserAccount(
      email,
      password,
      username,
      firstName,
      lastName,
      phoneE164,
      location.latitude,
      location.longitude,
      null,
      null,
      null,
      null,
      null,
      'owner',
      'active',
    );
    setUser(data.data);
    if (!data.success) {
      setErrors(es => ({
        ...es,
        creatingProfile: data?.message || 'Failed to create profile',
      }));
      setProcessing(ps => ({ ...ps, creatingProfile: false }));
      setStepDone(sd => ({ ...sd, creatingProfile: true }));
      return null;
    }
    setUser(data.data);
    setProcessing(ps => ({ ...ps, creatingProfile: false }));
    setStepDone(sd => ({ ...sd, creatingProfile: true }));
    return data.data;
  };

  const createBusiness = async () => {
    setProcessing({ ...processing, creatingBusiness: true });
    const businessName = await AsyncStorage.getItem('businessName');
    const businessPhone = await AsyncStorage.getItem('businessPhone');
    const businessIndustry = await AsyncStorage.getItem('businessIndustry');
    const businessAddress = await AsyncStorage.getItem('businessAddress');
    const businessLatitude = await AsyncStorage.getItem('businessLatitude');
    const businessLongitude = await AsyncStorage.getItem('businessLongitude');
    const splitAddress = businessAddress?.split(', ');
    const b_address = splitAddress?.[0];
    const b_city = splitAddress?.[1];
    const b_state = splitAddress?.[2];
    const b_country = splitAddress?.[3];
    const phoneE164 = toE164US(businessPhone || '');
    const { data } = await createBusinessAccount(
      businessName,
      businessIndustry,
      phoneE164,
      null,
      null,
      b_address,
      null,
      b_city,
      b_state,
      null,
      b_country,
      parseFloat(businessLatitude || '0'),
      parseFloat(businessLongitude || '0'),
      null,
      null,
      null,
      false,
      false,
      'active',
      {},
    );
    setBusiness(data.data);
    if (!data.success) {
      setErrors(es => ({
        ...es,
        creatingBusiness: data?.message || 'Failed to create business',
      }));
      setProcessing(ps => ({ ...ps, creatingBusiness: false }));
      setStepDone(sd => ({ ...sd, creatingBusiness: true }));
      return null;
    }
    setBusiness(data.data);
    setProcessing(ps => ({ ...ps, creatingBusiness: false }));
    setStepDone(sd => ({ ...sd, creatingBusiness: true }));
    return data.data;
  };

  const createEmployee = async (biz: any, usr: any) => {
    setProcessing({ ...processing, creatingEmployee: true });
    const { data } = await createEmployeeAccount(
      biz?.id,
      usr?.id,
      'active',
      'full_time',
      'Admin',
      null,
      null,
      new Date().toISOString(),
      null,
      false,
      null,
      null,
      null,
      null,
      usr.phone,
      usr.email,
      null,
      null,
      {},
      'available',
    );
    if (!data.success) {
      setErrors(es => ({
        ...es,
        creatingEmployee: data?.message || 'Failed to create employee',
      }));
      setProcessing(ps => ({ ...ps, creatingEmployee: false }));
      setStepDone(sd => ({ ...sd, creatingEmployee: true }));
      return;
    }
    setEmployee(data.data);
    setProcessing(ps => ({ ...ps, creatingEmployee: false }));
    setStepDone(sd => ({ ...sd, creatingEmployee: true }));
    return data.data;
  };

  const createCustomer = async (biz: any, usr: any) => {
    setProcessing({ ...processing, creatingCustomer: true });
    const { data } = await createCustomerAccount(
      biz?.id,
      '',
      biz?.name,
      biz?.phone,
      biz?.email,
      `${usr.first_name} ${usr.last_name}`,
      usr.email,
      usr.phone,
      biz.address_line1,
      '',
      biz.city,
      biz.region,
      biz.postal_code,
      biz.country_code,
      biz.latitude,
      biz.longitude,
      null,
      0,
      null,
      '',
      {},
      true,
    );
    if (!data.success) {
      setErrors(es => ({
        ...es,
        creatingCustomer: data?.message || 'Failed to create customer',
      }));
      setProcessing(ps => ({ ...ps, creatingCustomer: false }));
      setStepDone(sd => ({ ...sd, creatingCustomer: true }));
      return;
    }
    setCustomer(data.data);
    setProcessing(ps => ({ ...ps, creatingCustomer: false }));
    setStepDone(sd => ({ ...sd, creatingCustomer: true }));
    return data.data;
  };

  const sendEmail = async () => {
    setProcessing(ps => ({ ...ps, sendingEmail: true }));
    // Simulate API call for sending email
    const interval = setInterval(() => {
      setErrors(es => ({
        ...es,
        sendingEmail: null,
      }));
      setProcessing(ps => ({ ...ps, sendingEmail: false }));
      setStepDone(sd => ({ ...sd, sendingEmail: true }));
      clearInterval(interval);
    }, 1500);
  };

  const FinishingUp = async (biz: any, usr: any, empl: any, cust: any) => {
    setProcessing({ ...processing, finishingUp: true });
    const { data } = await updateProfileAndBusiness(usr, biz, empl, cust);
    if (!data.success) {
      console.log('data', JSON.stringify(data, null, 2));
      setErrors(es => ({
        ...es,
        finishingUp: data?.message || 'Failed to finish up',
      }));
      setProcessing(ps => ({ ...ps, finishingUp: false }));
      setStepDone(sd => ({ ...sd, finishingUp: true }));
      return;
    }
    console.log('data', JSON.stringify(data, null, 2));
    setCustomer(data.data);
    setProcessing(ps => ({ ...ps, finishingUp: false }));
    setStepDone(sd => ({ ...sd, finishingUp: true }));
    return data.data;
  };

  const nextScreen = async () => {
    await AsyncStorage.clear();
    navigation.navigate('Login');
  };

  return (
    <View
      style={[
        tw`flex-1 items-center justify-between`,
        { backgroundColor: colors.bg },
      ]}
    >
      {/* Accent bar */}
      <View
        style={[
          tw`w-1/3 h-2 mt-6 rounded-full`,
          { backgroundColor: colors.brand.primary },
        ]}
      />

      <View style={tw`w-11/12 mt-6`}>
        <Text style={[tw`text-2xl font-semibold`, { color: colors.text }]}>
          Setting up your account…
        </Text>
        <Text style={[tw`mt-2 text-base`, { color: colors.muted }]}>
          This takes a few seconds. We’ll email you a verification link.
        </Text>
      </View>

      {/* Steps */}
      <View style={[tw`w-11/12 rounded-3 mt-5 p-4`]}>
        <StepRow
          // Updated label to reflect the first step includes location fetching
          label={
            location.latitude === null && processing.creatingProfile
              ? 'Fetching Current Location' // Show location fetching status
              : 'Creating Profile' // Show profile creation status
          }
          done={stepDone.creatingProfile}
          processing={processing.creatingProfile}
          error={!!errors.creatingProfile}
          errorMessage={errors.creatingProfile}
        />
        <StepRow
          label="Creating Business"
          done={stepDone.creatingBusiness}
          processing={processing.creatingBusiness}
          error={!!errors.creatingBusiness}
          errorMessage={errors.creatingBusiness}
        />
        <StepRow
          label="Creating Default Employee"
          done={stepDone.creatingEmployee}
          processing={processing.creatingEmployee}
          error={!!errors.creatingEmployee}
          errorMessage={errors.creatingEmployee}
        />
        <StepRow
          label="Creating Default Customer"
          done={stepDone.creatingCustomer}
          processing={processing.creatingCustomer}
          error={!!errors.creatingCustomer}
          errorMessage={errors.creatingCustomer}
        />
        <StepRow
          label="Finishing up"
          done={stepDone.finishingUp}
          processing={processing.finishingUp}
          error={!!errors.finishingUp}
          errorMessage={errors.finishingUp}
        />
        <StepRow
          label="Sending Verification Email"
          done={stepDone.sendingEmail}
          processing={processing.sendingEmail}
          error={!!errors.sendingEmail}
          errorMessage={errors.sendingEmail}
        />
      </View>

      {stepDone.creatingProfile &&
        stepDone.creatingBusiness &&
        stepDone.creatingEmployee &&
        stepDone.creatingCustomer &&
        stepDone.finishingUp &&
        stepDone.sendingEmail && (
          <View style={tw` w-11/12`}>
            <AuthBotton
              label="Back to Login"
              loading={false}
              onPress={nextScreen}
            />
          </View>
        )}

      {/* Footer */}
      <View style={tw`w-11/12 mt-auto mb-6`}>
        <Text style={[tw`text-xs text-center`, { color: colors.muted }]}>
          If you do not receive an email for account verification, check your
          spam folder or contact us.
        </Text>
      </View>
    </View>
  );
};

export default CreatingProfileScreen;
