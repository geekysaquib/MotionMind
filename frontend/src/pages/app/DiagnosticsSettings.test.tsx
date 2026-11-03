import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { log } from '../../lib/logger';
import { DiagnosticsSettings } from './DiagnosticsSettings';

describe('DiagnosticsSettings', () => {
  afterEach(() => {
    cleanup();
    log.clear();
    jest.restoreAllMocks();
  });

  it('lists recent entries, newest first, and filters by level', () => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    log.info('router', 'Opened /app');
    log.error('api', 'GET /projects failed');
    render(<DiagnosticsSettings />);

    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toContain('[api] GET /projects failed');
    expect(items[1]).toContain('[router] Opened /app');

    fireEvent.click(screen.getByRole('button', { name: 'error' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('updates live and can be cleared', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    render(<DiagnosticsSettings />);
    expect(screen.getByText('Nothing logged yet.')).toBeTruthy();
    act(() => log.warn('ui', 'Error shown to user: oops'));
    expect(screen.getByText(/Error shown to user: oops/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Nothing logged yet.')).toBeTruthy();
  });

  it('copies the log as text', async () => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
    const writeText = jest.fn(async (_t: string) => {});
    Object.assign(navigator, { clipboard: { writeText } });
    log.info('app', 'Started in api mode');
    render(<DiagnosticsSettings />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    expect(writeText.mock.calls[0]?.[0]).toContain('[app] Started in api mode');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
  });
});
