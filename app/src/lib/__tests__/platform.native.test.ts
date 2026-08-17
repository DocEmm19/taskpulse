jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
import * as cap from '../platform';

test('native enables capabilities', () => {
  expect(cap.isWeb).toBe(false);
  expect(cap.canUseCamera).toBe(true);
  expect(cap.canRecordAudio).toBe(true);
  expect(cap.canUseContacts).toBe(true);
  expect(cap.canUseDeviceCalendar).toBe(true);
  expect(cap.canUseLocalNotifications).toBe(true);
});
