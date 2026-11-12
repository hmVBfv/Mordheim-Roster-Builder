/* A screen that fails to draw must not take the whole app with it: the frame
   (title, sync state, the Bug button, the navigation) stays, the screen says
   what happened and offers a way on. The error goes into the trail a report
   carries (concept.md 4.12), so "Report a bug" in the header says what broke.
   A change of screen (`resetKey`) tries again. */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { addError } from '../bugs/trail.ts';
import ui from './ui.module.css';

interface Props { children: ReactNode; resetKey: string }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // the component stack names components, never data
    addError(`${error.name}: ${error.message}`, (info.componentStack ?? '').trim().split('\n')[0] ?? '');
  }

  override componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <section className={ui.page} role="alert">
        <h1>Something went wrong on this page</h1>
        <p className={ui.muted}>Nothing you entered is lost. Reload to try again, or use “Bug” at the top to tell us what happened – the details go with the report.</p>
        <p><button type="button" className={ui.button} onClick={() => window.location.reload()}>Reload</button></p>
        <p className={ui.muted}><small>{error.name}: {error.message}</small></p>
      </section>
    );
  }
}
