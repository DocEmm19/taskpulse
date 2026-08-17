jest.mock('../../store/sessionStore', () => ({
  getDeviceId: () => 'device-1',
  getCurrentUserName: jest.fn(() => 'Abhay'),
}));

import { buildActivityRow } from '../helpers';

describe('buildActivityRow', () => {
  test('attributes the row to the logged-in user via getCurrentUserName', () => {
    const row = buildActivityRow('task-1', 'created', 'Task created');
    expect(row.actor_name).toBe('Abhay');
  });

  test('un-complete (reopen) path yields a distinct reopened event type', () => {
    const row = buildActivityRow('task-1', 'reopened', 'Task reopened');
    expect(row.event_type).toBe('reopened');
    expect(row.actor_name).toBe('Abhay');
  });
});
