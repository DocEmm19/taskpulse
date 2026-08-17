jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

class FakeNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission = jest.fn(async () => FakeNotification.permission);
  static instances: FakeNotification[] = [];

  title: string;
  body?: string;

  constructor(title: string, options?: { body?: string }) {
    this.title = title;
    this.body = options?.body;
    FakeNotification.instances.push(this);
  }
}

function installNotificationGlobal(permission: NotificationPermission) {
  FakeNotification.permission = permission;
  FakeNotification.instances = [];
  FakeNotification.requestPermission.mockClear();
  (global as any).Notification = FakeNotification;
}

function removeNotificationGlobal() {
  delete (global as any).Notification;
}

describe('webReminders', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    removeNotificationGlobal();
    delete (global as any).navigator;
  });

  test('permission granted + due reminder fires a Notification with title/body', () => {
    installNotificationGlobal('granted');
    const { scheduleWebReminder } = require('../webReminders');

    scheduleWebReminder({ id: 'r1', title: 'Due today', body: 'Call the client', fireAt: Date.now() });
    jest.runOnlyPendingTimers();

    expect(FakeNotification.instances).toHaveLength(1);
    expect(FakeNotification.instances[0].title).toBe('Due today');
    expect(FakeNotification.instances[0].body).toBe('Call the client');
  });

  test('ensureWebNotificationPermission returns true iff permission granted after request', async () => {
    installNotificationGlobal('default');
    FakeNotification.requestPermission.mockResolvedValueOnce('granted');
    const { ensureWebNotificationPermission } = require('../webReminders');

    await expect(ensureWebNotificationPermission()).resolves.toBe(true);
    expect(FakeNotification.requestPermission).toHaveBeenCalled();
  });

  test('permission denied → no Notification constructed, no throw', async () => {
    installNotificationGlobal('default');
    FakeNotification.requestPermission.mockResolvedValueOnce('denied');
    const { ensureWebNotificationPermission, scheduleWebReminder } = require('../webReminders');

    await expect(ensureWebNotificationPermission()).resolves.toBe(false);

    // A denied-permission schedule must be a clean no-op when the timer fires.
    FakeNotification.permission = 'denied';
    expect(() => {
      scheduleWebReminder({ id: 'r2', title: 'x', body: 'y', fireAt: Date.now() });
      jest.runOnlyPendingTimers();
    }).not.toThrow();
    expect(FakeNotification.instances).toHaveLength(0);
  });

  test('Notification undefined (unsupported) → ensureWebNotificationPermission false, scheduleWebReminder no-throw no-op', async () => {
    removeNotificationGlobal();
    const { ensureWebNotificationPermission, scheduleWebReminder } = require('../webReminders');

    await expect(ensureWebNotificationPermission()).resolves.toBe(false);
    expect(() => {
      scheduleWebReminder({ id: 'r3', title: 'x', body: 'y', fireAt: Date.now() });
      jest.runOnlyPendingTimers();
    }).not.toThrow();
  });

  test('cancelWebReminder prevents the fire', () => {
    installNotificationGlobal('granted');
    const { scheduleWebReminder, cancelWebReminder } = require('../webReminders');

    scheduleWebReminder({ id: 'r4', title: 'x', body: 'y', fireAt: Date.now() + 10_000 });
    cancelWebReminder('r4');
    jest.runAllTimers();

    expect(FakeNotification.instances).toHaveLength(0);
  });
});
