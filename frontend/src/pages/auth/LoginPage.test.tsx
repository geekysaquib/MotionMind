import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { log } from '../../lib/logger';
import { DEMO_CODE } from '../../services/memory';
import { makeStore, renderWithStore } from '../../test-utils';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  afterEach(() => {
    cleanup();
    log.clear();
    jest.restoreAllMocks();
  });

  it('asks for an email, then signs in with the code', async () => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
    const store = await makeStore();
    renderWithStore(<LoginPage />, store);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'saquib@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));

    expect(await screen.findByText(/We sent a 6-digit code to saquib@example.com/)).toBeTruthy();
    expect(screen.getByText(`Demo mode sends no email. Use code ${DEMO_CODE}.`)).toBeTruthy();
    const signIn = screen.getByRole('button', { name: 'Sign in' }) as HTMLButtonElement;
    expect(signIn.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Sign-in code'), { target: { value: `${DEMO_CODE}` } });
    fireEvent.click(signIn);
    await waitFor(() => expect(store.auth.isSignedIn).toBe(true));
    expect(log.all().map((e) => e.msg)).toEqual(expect.arrayContaining(['Sign-in code requested', 'Signed in']));
  });

  it('keeps only digits in the code box', async () => {
    const store = await makeStore();
    renderWithStore(<LoginPage />, store);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    const box = (await screen.findByLabelText('Sign-in code')) as HTMLInputElement;
    fireEvent.change(box, { target: { value: '12ab34' } });
    expect(box.value).toBe('1234');
  });

  it('shows the error for a wrong code and logs it', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    const store = await makeStore();
    renderWithStore(<LoginPage />, store);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    fireEvent.change(await screen.findByLabelText('Sign-in code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText("That code isn't right.")).toBeTruthy();
    expect(store.auth.isSignedIn).toBe(false);
    expect(log.all().at(-1)).toMatchObject({ level: 'warn', scope: 'auth' });
  });

  it('rejects an invalid email', async () => {
    const store = await makeStore();
    renderWithStore(<LoginPage />, store);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Send code' }).closest('form')!);
    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
  });

  it('can go back and use a different email', async () => {
    const store = await makeStore();
    renderWithStore(<LoginPage />, store);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use a different email' }));
    expect(screen.getByRole('button', { name: 'Send code' })).toBeTruthy();
  });
});
