import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { TabNavigator } from './TabNavigator';
import { NewEditTaskScreen } from '../screens/NewEditTaskScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import { ReassignScreen } from '../screens/ReassignScreen';
import { ContactDetailScreen } from '../screens/ContactDetailScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { CategoriesScreen } from '../screens/CategoriesScreen';
import { SyncStatusScreen } from '../screens/SyncStatusScreen';
import { NewTaskFab } from '../components/Fab';
import { RootStackParamList } from './types';
import { colors } from '../theme/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** The FAB needs to sit above whichever screen is currently showing (every
 * tab, per Req. #33/#37) but must not appear over full-screen flows like
 * New Task or Task Detail. Wrapping just the Tabs route accomplishes that
 * without any global-overlay bookkeeping. */
function TabsWithFab() {
  return (
    <View style={{ flex: 1 }}>
      <TabNavigator />
      <NewTaskFab />
    </View>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerTitleStyle: { fontWeight: '700' }, headerTintColor: colors.textPrimary, headerStyle: { backgroundColor: colors.surface }, headerShadowVisible: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="Tabs" component={TabsWithFab} options={{ headerShown: false }} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'Task' }} />
      <Stack.Screen name="NewTask" component={NewEditTaskScreen} options={{ title: 'New Task', presentation: 'modal' }} />
      <Stack.Screen name="EditTask" component={NewEditTaskScreen} options={{ title: 'Edit Task', presentation: 'modal' }} />
      <Stack.Screen name="Reassign" component={ReassignScreen} options={{ title: 'Reassign Task', presentation: 'modal' }} />
      <Stack.Screen name="ContactDetail" component={ContactDetailScreen} options={{ title: 'Contact', presentation: 'modal' }} />
      <Stack.Screen name="More" component={MoreScreen} options={{ title: 'More' }} />
      <Stack.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Categories' }} />
      <Stack.Screen name="SyncStatus" component={SyncStatusScreen} options={{ title: 'Sync Status' }} />
    </Stack.Navigator>
  );
}
