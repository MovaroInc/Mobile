// src/navigation/stacks/AuthStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import DriversScreen from '../../../app/drivers/DriversScreen';
import DriverInviteScreen from '../../../app/drivers/DriverInviteScreen';
import ProfileScreen from '../../../app/users/ProfileScreen';
type AuthParamList = {
  Drivers: undefined;
};
const Stack = createStackNavigator<AuthParamList>();

export default function ProfileStackNavigation() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}
