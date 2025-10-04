// src/screens/Auth/LegalAgreementsScreen.tsx
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Linking } from 'react-native';
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
import { grabCurrentLocation } from '../../shared/lib/locations';
import StepRow from '../../shared/components/info/StepRow';
import { toE164US } from '../../shared/utils/phone';
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

  useLayoutEffect(() => {
    const grabLocation = async () => {
      const { longitude, latitude } = await grabCurrentLocation();
      setLocation({ longitude, latitude });
    };
    grabLocation();
  }, []);

  useEffect(() => {
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
      await sendEmail();
    } catch (error) {
      console.error(error);
    }
  };

  const createProfile = async () => {
    setProcessing({ ...processing, creatingProfile: true });
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
    console.log('splitAddress', splitAddress);
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
        creatingBusiness: res?.message || 'Failed to create business',
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
      'business owner',
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
    console.log('creating customer', biz, usr);
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
      biz.industry,
      0,
      null,
      '',
      {},
      true,
    );
    console.log('customer', data);
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
    setInterval(() => {
      setErrors(es => ({
        ...es,
        sendingEmail: null,
      }));
      setProcessing(ps => ({ ...ps, sendingEmail: false }));
      setStepDone(sd => ({ ...sd, sendingEmail: true }));
    }, 1500);
  };

  const FinishingUp = async (biz: any, usr: any, empl: any, cust: any) => {
    console.log('finishing up', usr, biz, empl, cust);
    setProcessing({ ...processing, finishingUp: true });
    const { data } = await updateProfileAndBusiness(usr, biz, empl, cust);
    console.log('finishing', data);
    if (!data.success) {
      setErrors(es => ({
        ...es,
        finishingUp: data?.message || 'Failed to finish up',
      }));
      setProcessing(ps => ({ ...ps, finishingUp: false }));
      setStepDone(sd => ({ ...sd, finishingUp: true }));
      return;
    }
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
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      <View style={tw`flex-1 items-center`}>
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
            label="Creating profile"
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
    </SafeAreaView>
  );
};

export default CreatingProfileScreen;
