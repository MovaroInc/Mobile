// src/navigation/stacks/AuthStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../../app/home/HomeScreen';
import AdminHomeScreen from '../../app/home/AdminHomeScreen';

type AuthParamList = {
  Home: undefined;
};
const Stack = createStackNavigator<AuthParamList>();

export default function AdminNavigation() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={AdminHomeScreen} />
    </Stack.Navigator>
  );
}
