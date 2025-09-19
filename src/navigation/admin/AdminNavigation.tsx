// src/navigation/tabs/FounderTabs.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import TabIcon from '../components/TabIcon';
import {
  Activity,
  Users,
  Package,
  BarChart2,
  CreditCard,
  Settings,
} from 'react-native-feather';

import FounderDashboardStack from '../stacks/FounderDashboardStack';
import FounderAnalyticsStack from '../stacks/FounderAnalyticsStack';
import FounderOperationsStack from '../stacks/FounderOperationStack';
import FounderSystemStack from '../stacks/FounderSystemStack';
import FounderFinanceStack from '../stacks/FounderFinanceStack';
import ProfileScreen from '@/screens/Home/ProfileScreen';
import PlaceHolderScreen from '../../app/PlaceHolderScreen';

type FounderTabParamList = {
  Dashboard: undefined;
  Users: undefined;
  Operations: undefined;
  Analytics: undefined;
  Requests: undefined;
  Profile: undefined;
};
const Tab = createBottomTabNavigator<FounderTabParamList>();

export default function AdminNavigation() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleAlign: 'center',
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#0ea5e9',
        tabBarInactiveTintColor: '#6b7280',
        tabBarHideOnKeyboard: true,
        lazy: true,
        tabBarStyle: { height: 70, borderTopWidth: 0.5 },
        tabBarIcon: ({ color, focused, size }) => {
          const map: Record<string, any> = {
            Dashboard: Activity,
            Users: Users,
            Operations: Package,
            Analytics: BarChart2,
            Requests: CreditCard,
            Profile: Settings,
          };
          const Icon = map[route.name];
          return (
            <TabIcon Icon={Icon} color={color} focused={focused} size={size} />
          );
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={PlaceHolderScreen} />
      <Tab.Screen name="Users" component={PlaceHolderScreen} />
      <Tab.Screen name="Operations" component={PlaceHolderScreen} />
      <Tab.Screen name="Analytics" component={PlaceHolderScreen} />
      <Tab.Screen name="Requests" component={PlaceHolderScreen} />
      <Tab.Screen name="Profile" component={PlaceHolderScreen} />
    </Tab.Navigator>
  );
}
