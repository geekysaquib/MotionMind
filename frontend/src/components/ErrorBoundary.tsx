import { Component, type ErrorInfo, type ReactNode } from 'react';
import { log } from '../lib/logger';

interface State {
  error: Error | null;
  copied: boolean;
}

/** Catches a crash anywhere below it, logs it, and shows a recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    log.error('ui', `The page crashed: ${error.message}`, { err: error, component: info.componentStack?.split('\n').slice(0, 6).join('\n') });
    log.flush();
  }

  private copy = async () => {
    try {
      await navigator.clipboard.writeText(log.toText());
      this.setState({ copied: true });
    } catch {
      /* clipboard blocked: the logs are still in Settings > Diagnostics */
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex h-full max-w-lg flex-col justify-center p-10">
        <h1 className="font-display text-2xl font-bold">Something broke on this page</h1>
        <p className="mt-3 text-sm text-ink-400">The error was saved to the app's log. Reloading usually fixes it. If it keeps happening, copy the log and send it along.</p>
        <pre className="mt-4 overflow-auto rounded-xl bg-ink-900 p-3 text-xs text-danger">{this.state.error.message}</pre>
        <div className="mt-6 flex gap-3">
          <button className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-ink-950" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button className="rounded-xl border border-line/15 px-4 py-2 text-sm font-medium" onClick={() => void this.copy()}>
            {this.state.copied ? 'Copied' : 'Copy log'}
          </button>
        </div>
      </div>
    );
  }
}
