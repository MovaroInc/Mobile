// src/navigation/stacks/AuthStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../../../shared/hooks/useTheme';
import RoutesScreen from '../../../app/routes/RoutesScreen';
import CreateRouteStep1Screen from '../../../app/routes/CreateRouteStep1Screen';
import RouteDraftScreen from '../../../app/routes/RouteDraftScreen';
type AuthParamList = {
  Routes: undefined;
  CreateRouteStep1: undefined;
  RouteDraftScreen: { routeId: number; payload: any };
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
      <Stack.Screen name="Routes" component={RoutesScreen} />
      <Stack.Screen
        name="CreateRouteStep1"
        component={CreateRouteStep1Screen}
      />
      <Stack.Screen name="RouteDraftScreen" component={RouteDraftScreen} />
    </Stack.Navigator>
  );
}
