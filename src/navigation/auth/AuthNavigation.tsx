// src/navigation/stacks/AuthStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../../app/auth/LoginScreen';
import SignupBusinessAccountScreen from '../../app/auth/SignupBusinessAccountScreen';
import SignupBusinessProfileScreen from '../../app/auth/SignupBusinessProfileScreen';
import SignupBusinessScreen from '../../app/auth/SignupBusinessScreen';
import ValidateNotificationsScreen from '../../app/auth/ValidateNotificationsScreen';
import ValidateLocationScreen from '../../app/auth/ValidateLocationScreen';
import AcceptingLegalScreen from '../../app/auth/AcceptingLegalScreen';
import CreatingProfileScreen from '../../app/auth/CreatingProfileScreen';

type AuthParamList = {
  Login: undefined;
  SignupBusinessAccount: undefined;
  SignupBusinessProfile: undefined;
  SignupBusiness: undefined;
  ValidateNotifications: undefined;
  ValidateLocation: undefined;
  AcceptingLegal: undefined;
  CreatingProfile: undefined;
};
const Stack = createStackNavigator<AuthParamList>();

export default function AuthNavigation() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="SignupBusinessAccount"
        component={SignupBusinessAccountScreen}
      />
      <Stack.Screen
        name="SignupBusinessProfile"
        component={SignupBusinessProfileScreen}
      />
      <Stack.Screen name="SignupBusiness" component={SignupBusinessScreen} />
      <Stack.Screen
        name="ValidateNotifications"
        component={ValidateNotificationsScreen}
      />
      <Stack.Screen
        name="ValidateLocation"
        component={ValidateLocationScreen}
      />
      <Stack.Screen name="AcceptingLegal" component={AcceptingLegalScreen} />
      <Stack.Screen name="CreatingProfile" component={CreatingProfileScreen} />
    </Stack.Navigator>
  );
}
