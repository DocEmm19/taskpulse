import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';
const native = !isWeb;

export const canUseCamera = native;
export const canRecordAudio = native;
export const canUseContacts = native;
export const canUseDeviceCalendar = native;
export const canUseLocalNotifications = native;
