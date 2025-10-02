// src/navigation/stacks/AuthStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../../../shared/hooks/useTheme';
import RoutesScreen from '../../../app/routes/RoutesScreen';
import CreateRouteStep1Screen from '../../../app/routes/CreateRouteStep1Screen';
import RouteDraftScreen from '../../../app/routes/RouteDraftScreen';
import AddStopScreen1 from '../../../app/stops/AddStopScreen1';
import AddStopScreen2 from '../../../app/stops/AddStopScreen2';
import AddStopPhotosScreen from '../../../app/stops/AddStopPhotosScreen';
import AddStopScreen3 from '../../../app/stops/AddStopScreen3';
type AuthParamList = {
  Routes: undefined;
  CreateRouteStep1: undefined;
  RouteDraftScreen: { routeId: number; payload: any };
  AddStopScreen1: { routeId: number; stopsCount: number };
  AddStopScreen2: { routeId: number; stopsCount: number };
  AddStopPhotosScreen: { stopId: number };
  AddStopScreen3: { routeId: number; stopsCount: number };
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
      <Stack.Screen name="AddStopScreen1" component={AddStopScreen1} />
      <Stack.Screen name="AddStopScreen2" component={AddStopScreen2} />
      <Stack.Screen
        name="AddStopPhotosScreen"
        component={AddStopPhotosScreen}
      />
      <Stack.Screen name="AddStopScreen3" component={AddStopScreen3} />
    </Stack.Navigator>
  );
}
