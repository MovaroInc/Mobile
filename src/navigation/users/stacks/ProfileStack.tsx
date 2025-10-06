// src/navigation/stacks/AuthStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ProfileScreen from '../../../app/users/ProfileScreen';
import AboutScreen from '../../../app/users/AboutScreen';
import ContactSupportScreen from '../../../app/users/ContactSupportScreen';
import ManageSubscriptionScreen from '../../../app/users/ManageSubscriptionScreen';
import BillingHistoryScreen from '../../../app/users/BillingHistoryScreen';
import UpdateProfileScreen from '../../../app/users/UpdateProfileScreen';
import ChangePasswordScreen from '../../../app/users/ChangePasswordScreen';
import EditBusinessInfoScreen from '../../../app/users/EditBusinessInfoScreen';
type AuthParamList = {
  Profile: undefined;
  About: undefined;
  ContactSupport: undefined;
  ManageSubscription: undefined;
  BillingHistory: undefined;
  UpdateProfile: undefined;
  ChangePassword: undefined;
  EditBusinessInfo: undefined;
};
const Stack = createStackNavigator<AuthParamList>();

export default function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="ContactSupport" component={ContactSupportScreen} />
      <Stack.Screen
        name="ManageSubscription"
        component={ManageSubscriptionScreen}
      />
      <Stack.Screen name="BillingHistory" component={BillingHistoryScreen} />
      <Stack.Screen name="UpdateProfile" component={UpdateProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen
        name="EditBusinessInfo"
        component={EditBusinessInfoScreen}
      />
    </Stack.Navigator>
  );
}
