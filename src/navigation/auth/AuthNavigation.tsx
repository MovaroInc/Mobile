// src/navigation/stacks/AuthStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import PlaceHolderScreen from '../../app/PlaceHolderScreen';
import LoginScreen from '../../app/auth/LoginScreen';

type AuthParamList = {
  Login: undefined;
  Register: undefined;
};
const Stack = createStackNavigator<AuthParamList>();

export default function AuthNavigation() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={PlaceHolderScreen} />
    </Stack.Navigator>
  );
}
