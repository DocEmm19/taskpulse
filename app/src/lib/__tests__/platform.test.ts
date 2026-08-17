jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
import * as cap from '../platform';

test('web disables native-only capabilities', () => {
  expect(cap.isWeb).toBe(true);
  expect(cap.canUseCamera).toBe(false);
  expect(cap.canRecordAudio).toBe(false);
  expect(cap.canUseContacts).toBe(false);
  expect(cap.canUseDeviceCalendar).toBe(false);
  expect(cap.canUseLocalNotifications).toBe(false);
});
