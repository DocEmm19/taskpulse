import { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  Tasks: undefined;
  Calendar: undefined;
  Travel: undefined;
  Contacts: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  TaskDetail: { taskId: string };
  NewTask: { presetCategory?: string } | undefined;
  EditTask: { taskId: string };
  Reassign: { taskId: string };
  ContactDetail: { contactId?: string };
  More: undefined;
  Categories: undefined;
  SyncStatus: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
