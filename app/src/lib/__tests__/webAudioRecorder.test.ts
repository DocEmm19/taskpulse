jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

type Listener = (...args: any[]) => void;

class FakeMediaRecorder {
  static isTypeSupported = jest.fn(() => true);
  static instances: FakeMediaRecorder[] = [];
  mimeType: string;
  state: 'inactive' | 'recording' = 'inactive';
  private listeners: Record<string, Listener[]> = {};

  constructor(
    public stream: unknown,
    options?: { mimeType?: string }
  ) {
    this.mimeType = options?.mimeType ?? '';
    FakeMediaRecorder.instances.push(this);
  }

  addEventListener(event: string, cb: Listener) {
    (this.listeners[event] ??= []).push(cb);
  }

  start() {
    this.state = 'recording';
  }

  /** Test-only switch: makes the next `stop()` call fire 'error' instead of completing normally. */
  failNextStop = false;

  stop() {
    this.state = 'inactive';
    if (this.failNextStop) {
      this.listeners['error']?.forEach((cb) => cb(new Event('error')));
      return;
    }
    const blob = new Blob(['fake-audio-bytes'], { type: this.mimeType || 'audio/webm' });
    this.listeners['dataavailable']?.forEach((cb) => cb({ data: blob }));
    this.listeners['stop']?.forEach((cb) => cb());
  }
}

const fakeTrack = { stop: jest.fn() };
const fakeStream = { getTracks: jest.fn(() => [fakeTrack]) };
const getUserMedia = jest.fn().mockResolvedValue(fakeStream);

// jest-expo's RN test environment monkey-patches the real `URL.createObjectURL`
// to require a native BlobModule that only exists on-device, so it throws
// under Jest. Stub it here to stand in for the real browser implementation
// that runs when this code actually ships to web.
const createObjectURL = jest.fn(() => 'blob:mock-recording-id');
const originalCreateObjectURL = URL.createObjectURL;

function installBrowserGlobals() {
  (global as any).navigator = { mediaDevices: { getUserMedia } };
  (global as any).MediaRecorder = FakeMediaRecorder;
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
}

function removeBrowserGlobals() {
  delete (global as any).navigator;
  delete (global as any).MediaRecorder;
  URL.createObjectURL = originalCreateObjectURL;
}

describe('webAudioRecorder', () => {
  beforeEach(() => {
    jest.resetModules();
    getUserMedia.mockClear();
    fakeTrack.stop.mockClear();
    fakeStream.getTracks.mockClear();
    createObjectURL.mockClear();
    FakeMediaRecorder.instances = [];
  });

  afterEach(() => {
    removeBrowserGlobals();
  });

  test('start -> stop yields a non-empty audio uri, mime type, and file name', async () => {
    installBrowserGlobals();
    const { startWebRecording } = require('../webAudioRecorder');

    const handle = await startWebRecording();
    const result = await handle.stop();

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(typeof result.uri).toBe('string');
    expect(result.uri.length).toBeGreaterThan(0);
    expect(result.mimeType).toMatch(/^audio\//);
    expect(result.fileName.length).toBeGreaterThan(0);
    expect(fakeTrack.stop).toHaveBeenCalledTimes(1);
  });

  test('webRecordingSupported is true when the browser APIs are present', () => {
    installBrowserGlobals();
    const { webRecordingSupported } = require('../webAudioRecorder');
    expect(webRecordingSupported).toBe(true);
  });

  test('stop() rejects with an Error (not a raw Event) if the recorder errors mid-stop', async () => {
    installBrowserGlobals();
    const { startWebRecording } = require('../webAudioRecorder');

    const handle = await startWebRecording();
    FakeMediaRecorder.instances[FakeMediaRecorder.instances.length - 1].failNextStop = true;
    const stopPromise = handle.stop();

    await expect(stopPromise).rejects.toBeInstanceOf(Error);
    await expect(stopPromise).rejects.toThrow('Recording failed');
  });

  test('webRecordingSupported is false and startWebRecording throws when MediaRecorder is unavailable', async () => {
    (global as any).navigator = { mediaDevices: { getUserMedia } };
    // MediaRecorder deliberately left undefined.
    const { webRecordingSupported, startWebRecording } = require('../webAudioRecorder');

    expect(webRecordingSupported).toBe(false);
    await expect(startWebRecording()).rejects.toThrow(/not supported/i);
  });
});
