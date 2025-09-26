// src/navigation/stacks/AuthStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import AnalyticsScreen from '../../../app/users/AnalyticsScreen';
type AuthParamList = {
  Analytics: undefined;
};
const Stack = createStackNavigator<AuthParamList>();

export default function AnalyticsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Analytics" component={AnalyticsScreen} />
    </Stack.Navigator>
  );
}
