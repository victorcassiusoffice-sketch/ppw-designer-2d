import { useCallback, useEffect, useRef, useState } from 'react';
import type { DemoScene } from './demoRoute';
import { DESIGNER_VIEW_MESSAGE, isDesignerReadyMessage, isDesignerViewStateMessage, type EmbeddedDesignerView } from './embedMessages';

export interface EmbeddedDesignerProps {
  scene: DemoScene;
  view: EmbeddedDesignerView;
  className?: string;
  title?: string;
  loading?: 'eager' | 'lazy';
  onViewChange?: (view: EmbeddedDesignerView) => void;
}

/** Switching view leaves the browsing context, local edits and undo history intact. */
export function EmbeddedDesigner(props: EmbeddedDesignerProps) {
  return <DesignerFrame key={props.scene} {...props} />;
}

function DesignerFrame({ scene, view, className, title = 'Demo — interactive designer', loading, onViewChange }: EmbeddedDesignerProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [initialView] = useState(view);
  const currentView = useRef(view);
  currentView.current = view;
  const viewChanged = useRef(onViewChange);
  viewChanged.current = onViewChange;

  const sendView = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: DESIGNER_VIEW_MESSAGE, view: currentView.current }, window.location.origin);
  }, []);
  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (isDesignerReadyMessage(event.data)) {
        // The child may finish loading after the parent has changed view several times.
        sendView();
      } else if (isDesignerViewStateMessage(event.data) && event.data.view !== currentView.current) {
        viewChanged.current?.(event.data.view);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [sendView]);
  useEffect(() => { sendView(); }, [view, sendView]);

  return <iframe ref={frame} className={className} src={`/embed/designer?scene=${scene}&view=${initialView}`} title={title} loading={loading} allowFullScreen onLoad={sendView} />;
}
