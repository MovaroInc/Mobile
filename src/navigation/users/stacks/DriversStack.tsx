// src/navigation/stacks/AuthStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import DriversScreen from '../../../app/drivers/DriversScreen';
import DriverInviteScreen from '../../../app/drivers/DriverInviteScreen';
type AuthParamList = {
  Drivers: undefined;
  DriverInvite: undefined;
};
const Stack = createStackNavigator<AuthParamList>();

export default function DriversStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Drivers" component={DriversScreen} />
      <Stack.Screen name="DriverInvite" component={DriverInviteScreen} />
    </Stack.Navigator>
  );
}
