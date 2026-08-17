import { startRealtime, RealtimeChannelLike, RealtimeSupabaseClient } from '../realtime';

// ----------------------------------------------------------------------------
// Fakes — no real Supabase client, no real network. `makeFakeSupabase` mimics
// the exact chain this module calls: `.channel(name).on(...).subscribe()`,
// and records every `removeChannel` call so unsubscribe can be asserted.
// ----------------------------------------------------------------------------

function makeFakeSupabase() {
  const handlers: Array<(payload: unknown) => void> = [];
  const removedChannels: RealtimeChannelLike[] = [];
  let subscribeCalls = 0;

  const channelObj: RealtimeChannelLike = {
    on(_event, _filter, callback) {
      handlers.push(callback);
      return channelObj;
    },
    subscribe() {
      subscribeCalls += 1;
      return channelObj;
    },
  };

  const client: RealtimeSupabaseClient = {
    channel: jest.fn(() => channelObj),
    removeChannel: jest.fn((channel: RealtimeChannelLike) => {
      removedChannels.push(channel);
    }),
  };

  return { client, channelObj, handlers, removedChannels, getSubscribeCalls: () => subscribeCalls };
}

test('client null -> no-op unsubscribe, does not throw, onChange never called', () => {
  const onChange = jest.fn();

  const unsubscribe = startRealtime(onChange, { getSupabase: () => null });

  expect(() => unsubscribe()).not.toThrow();
  expect(onChange).not.toHaveBeenCalled();
});

test('wires a postgres_changes handler on the channel that calls onChange, and subscribes', () => {
  const onChange = jest.fn();
  const { client, handlers, getSubscribeCalls } = makeFakeSupabase();

  startRealtime(onChange, { getSupabase: () => client });

  expect(client.channel).toHaveBeenCalledTimes(1);
  expect(handlers.length).toBeGreaterThan(0);
  expect(getSubscribeCalls()).toBe(1);
  expect(onChange).not.toHaveBeenCalled();

  // Simulate a change event arriving from Supabase Realtime.
  handlers[0]({ eventType: 'UPDATE', table: 'tasks' });

  expect(onChange).toHaveBeenCalledTimes(1);
});

test('multiple change events each trigger onChange again', () => {
  const onChange = jest.fn();
  const { client, handlers } = makeFakeSupabase();

  startRealtime(onChange, { getSupabase: () => client });

  handlers[0]({});
  handlers[0]({});
  handlers[handlers.length - 1]({});

  expect(onChange).toHaveBeenCalledTimes(3);
});

test('returned unsubscribe function removes the channel exactly once', () => {
  const onChange = jest.fn();
  const { client, channelObj, removedChannels } = makeFakeSupabase();

  const unsubscribe = startRealtime(onChange, { getSupabase: () => client });
  unsubscribe();

  expect(removedChannels).toEqual([channelObj]);
  expect(client.removeChannel).toHaveBeenCalledTimes(1);
});
