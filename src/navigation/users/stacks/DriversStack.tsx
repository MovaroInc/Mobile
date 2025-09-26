// src/navigation/stacks/AuthStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import DriversScreen from '../../../app/users/DriversScreen';
type AuthParamList = {
  Drivers: undefined;
};
const Stack = createStackNavigator<AuthParamList>();

export default function DriversStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Drivers" component={DriversScreen} />
    </Stack.Navigator>
  );
}
