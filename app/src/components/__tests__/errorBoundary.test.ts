import { ErrorBoundary } from '../ErrorBoundary';

// getDerivedStateFromError is the pure crash→fallback reducer; test it directly
// (no renderer needed). If it stops flipping hasError, the app white-screens.
test('getDerivedStateFromError flips to the fallback with the error message', () => {
  expect(ErrorBoundary.getDerivedStateFromError(new Error('boom'))).toEqual({ hasError: true, message: 'boom' });
});

test('non-Error throwables still produce a fallback (never undefined message crash)', () => {
  expect(ErrorBoundary.getDerivedStateFromError('kaboom' as unknown as Error)).toEqual({ hasError: true, message: 'kaboom' });
});
