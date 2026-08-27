import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '../screens/HomeScreen';
import { TasksListScreen } from '../screens/TasksListScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { TravelScreen } from '../screens/TravelScreen';
import { ContactsScreen } from '../screens/ContactsScreen';
import { colors, spacing } from '../theme/theme';
import { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

const ICONS: Record<keyof TabParamList, { active: any; inactive: any }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Tasks: { active: 'list', inactive: 'list-outline' },
  Calendar: { active: 'calendar', inactive: 'calendar-outline' },
  Travel: { active: 'airplane', inactive: 'airplane-outline' },
  Contacts: { active: 'people', inactive: 'people-outline' },
};

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', color: colors.textPrimary },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { height: 64, paddingBottom: 8, paddingTop: 6, backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = ICONS[route.name as keyof TabParamList];
          return <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />;
        },
        // MORE lives behind a header icon rather than a 6th tab (Req. #37).
        headerRight: () => (
          <Ionicons
            name="menu-outline"
            size={24}
            color={colors.textPrimary}
            style={{ marginRight: spacing.lg }}
            onPress={() => navigation.getParent()?.navigate('More')}
          />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Tasks" component={TasksListScreen} options={{ title: 'Tasks' }} />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
      <Tab.Screen name="Travel" component={TravelScreen} options={{ title: 'Travel' }} />
      <Tab.Screen name="Contacts" component={ContactsScreen} options={{ title: 'Contacts' }} />
    </Tab.Navigator>
  );
}
