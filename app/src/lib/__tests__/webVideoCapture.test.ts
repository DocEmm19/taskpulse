import { videoExtensionFor } from '../webVideoCapture';

describe('videoExtensionFor', () => {
  test.each([
    ['video/mp4', 'mp4'],
    ['video/webm', 'webm'],
    ['video/webm;codecs=vp9', 'webm'],
    ['video/quicktime', 'mov'], // iOS Safari camera commonly yields this
    ['video/3gpp', '3gp'],
    ['video/ogg', 'ogv'],
    ['', 'webm'], // unknown/empty → safe default
    ['application/octet-stream', 'webm'],
  ])('%s -> %s', (mime, ext) => {
    expect(videoExtensionFor(mime)).toBe(ext);
  });
});
