// src/navigation/stacks/AuthStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SubscriptionScreen from '../../app/subscription/SubscriptionScreen';
import AddonsScreen from '../../app/subscription/AddonsScreen';
import ConfirmationScreen from '../../app/subscription/ConfirmationScreen';

type AuthParamList = {
  Subscription: undefined;
  Addons: undefined;
  Confirmation: undefined;
};
const Stack = createStackNavigator<AuthParamList>();

export default function SubscriptionNavigation() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="Addons" component={AddonsScreen} />
      <Stack.Screen name="Confirmation" component={ConfirmationScreen} />
    </Stack.Navigator>
  );
}
