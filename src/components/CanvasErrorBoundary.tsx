/**
 * CanvasErrorBoundary - safety net around the Konva Stage.
 *
 * Added in Week 4b Hotfix 5. Before Hotfix 5, a render-time crash in
 * RoomDrawMode (e.g. the portal-inside-Stage bug) propagated up and
 * unmounted the whole App, leaving Vic with a white screen. With this
 * boundary, an unexpected throw inside the canvas region is contained:
 * the rest of the app (TopBar, palette, details panel) stays alive,
 * Vic sees a clear "canvas error" panel, and he can try Reset to drop
 * the bad state and continue.
 */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional: callback fired when the boundary recovers via Reset. */
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log loudly - this is the safety net we want to surface.
    // eslint-disable-next-line no-console
    console.error('[canvas-error-boundary]', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-ppw-mist p-6">
          <div className="max-w-md rounded-lg border border-ppw-coral bg-white p-5 shadow-lg">
            <p className="text-sm font-semibold text-ppw-coral">
              Canvas hit an unexpected error
            </p>
            <p className="mt-2 text-xs text-ppw-slate">
              The drawing canvas crashed. The rest of the app is still
              usable. Click Reset to try again. Details are in the
              browser console under <code>[canvas-error-boundary]</code>.
            </p>
            <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-ppw-sand p-2 text-[10px] text-ppw-ink">
              {String(this.state.error?.message ?? this.state.error)}
            </pre>
            <button
              type="button"
              onClick={this.reset}
              className="mt-3 rounded-md border border-ppw-teal bg-ppw-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-ppw-teal/90"
            >
              Reset canvas
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
