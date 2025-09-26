// src/navigation/stacks/AuthStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import RouteScreen from '../../../app/users/RouteScreen';
import { useTheme } from '../../../shared/hooks/useTheme';
type AuthParamList = {
  Routes: undefined;
};
const Stack = createStackNavigator<AuthParamList>();

export default function RoutesStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.main },
      }}
    >
      <Stack.Screen name="Routes" component={RouteScreen} />
    </Stack.Navigator>
  );
}
