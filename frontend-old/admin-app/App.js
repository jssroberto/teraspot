import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

import DashboardScreen from './screens/DashboardScreen';
import AddDeviceScreen from './screens/AddDeviceScreen';
import EditorScreen from './screens/EditorScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator initialRouteName="Dashboard">
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: 'TeraSpot Admin' }}
        />
        <Stack.Screen
          name="AddDevice"
          component={AddDeviceScreen}
          options={{ title: 'Add New Device' }}
        />
        <Stack.Screen
          name="Editor"
          component={EditorScreen}
          options={{ title: 'ROI Editor' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
