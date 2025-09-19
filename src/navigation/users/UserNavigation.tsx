import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import TabIcon from '../components/TabIcon';
import {
  List,
  Users,
  Map as MapIcon,
  FileText,
  User,
} from 'react-native-feather';

import AdminStackNavigation from '../stacks/AdminStackNavigation';
import DriversStackNavigation from '../stacks/DriversStackNavigation';
import MapStackNavigation from '../stacks/MapStackNavigation';
import AnalyticsStackNavigation from '../stacks/AnalyticsStackNavigation';
import ProfileStackNavigation from '../stacks/ProfileStackNavigation';
import PlaceHolderScreen from '../../app/PlaceHolderScreen';

type AppTabParamList = {
  Tasks: undefined;
  Drivers: undefined;
  Map: undefined;
  Analytics: undefined;
  Profile: undefined;
};
const Tab = createBottomTabNavigator<AppTabParamList>();

export default function UserNavigation() {
  return (
    <Tab.Navigator
      initialRouteName="Tasks"
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: 'black',
        tabBarInactiveTintColor: 'gray',
        tabBarHideOnKeyboard: true,
        lazy: true,
        tabBarStyle: { height: 60, borderTopWidth: 0.5 },
        tabBarIcon: ({ color, focused, size }) => {
          switch (route.name) {
            case 'Tasks':
              return (
                <TabIcon
                  Icon={List}
                  color={color}
                  focused={focused}
                  size={size}
                />
              );
            case 'Drivers':
              return (
                <TabIcon
                  Icon={Users}
                  color={color}
                  focused={focused}
                  size={size}
                />
              );
            case 'Map':
              return (
                <TabIcon
                  Icon={MapIcon}
                  color={color}
                  focused={focused}
                  size={size}
                />
              );
            case 'Analytics':
              return (
                <TabIcon
                  Icon={FileText}
                  color={color}
                  focused={focused}
                  size={size}
                />
              );
            case 'Profile':
              return (
                <TabIcon
                  Icon={User}
                  color={color}
                  focused={focused}
                  size={size}
                />
              );
            default:
              return null;
          }
        },
      })}
    >
      <Tab.Screen name="Tasks" component={PlaceHolderScreen} />
      <Tab.Screen name="Drivers" component={PlaceHolderScreen} />
      <Tab.Screen name="Map" component={PlaceHolderScreen} />
      <Tab.Screen name="Analytics" component={PlaceHolderScreen} />
      <Tab.Screen name="Profile" component={PlaceHolderScreen} />
    </Tab.Navigator>
  );
}
