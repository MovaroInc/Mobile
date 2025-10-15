// src/navigation/stacks/AuthStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import DriverHomeMockScreen from '../../../app/drivers/DriverHomeMockScreen';
import SingleStopScreen from '../../../app/stops/SingleStopScreen';
type AuthParamList = {
  Drivers: undefined;
  Stop: { stop: any };
};

const Stack = createStackNavigator<AuthParamList>();

export default function TodaysStackNavigation() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Drivers" component={DriverHomeMockScreen} />
      <Stack.Screen name="Stop" component={SingleStopScreen} />
    </Stack.Navigator>
  );
}
