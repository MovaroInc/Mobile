// src/navigation/stacks/AuthStack.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import InboxScreen from '../../../app/inbox/InboxScreen';
type AuthParamList = {
  Inbox: undefined;
};
const Stack = createStackNavigator<AuthParamList>();

export default function InboxStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Inbox" component={InboxScreen} />
    </Stack.Navigator>
  );
}
