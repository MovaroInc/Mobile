// src/navigation/stacks/AuthStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../../app/auth/LoginScreen';
import HomeScreen from '../../app/home/HomeScreen';
import DriverHomeScreen from '../../app/home/DriverHomeScreen';
type AuthParamList = {
  Home: undefined;
};
const Stack = createStackNavigator<AuthParamList>();

export default function DriverNavigation() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={DriverHomeScreen} />
    </Stack.Navigator>
  );
}
