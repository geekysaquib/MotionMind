import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, render, screen } from '@testing-library/react';
import { log } from '../lib/logger';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    cleanup();
    log.clear();
    jest.restoreAllMocks();
  });

  it('shows the recovery screen and logs the crash', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {}); // React and the logger both print the crash
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Something broke on this page');
    expect(screen.getByText('kaboom')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy log' })).toBeTruthy();
    expect(log.all('error').at(-1)).toMatchObject({ scope: 'ui', msg: 'The page crashed: kaboom' });
  });

  it('renders children when nothing goes wrong', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeTruthy();
  });
});
