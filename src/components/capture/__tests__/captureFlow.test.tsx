/**
 * Capture-flow render proofs (`p1-capture-flow-finish` GATE-1 #4 + #5).
 *
 * Headless (jsdom, no real camera): every error state renders + offers a
 * recover action, the reconcile step gates Submit, and the submit path
 * carries optional side/back shots into the calibrate packet.
 *
 * Raw react-dom/client + flushSync pattern (no @testing-library) — matches
 * the repo convention (see OrdersPage.test.tsx).
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { act } from 'react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { CaptureModal } from '../CaptureModal';
import { CameraStage, type CapturedFrame } from '../CameraStage';
import { ShotSet } from '../ShotSet';
import { ReviewSubmit } from '../ReviewSubmit';
import type { ScaleFromMarkerOutput } from '../../../lib/capture/scaleFromMarker';

// ─── jsdom shims ─────────────────────────────────────────────────────────
beforeEach(() => {
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:test';
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  vi.restoreAllMocks();
});

function render(node: React.ReactElement): void {
  act(() => { flushSync(() => { root.render(node); }); });
}
async function flushAsync(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await Promise.resolve(); });
  }
}
function buttonByText(text: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll('button')].find(
    (b) => (b.textContent ?? '').trim() === text,
  );
  if (!btn) throw new Error(`button "${text}" not found in: ${[...container.querySelectorAll('button')].map((b) => b.textContent).join(' | ')}`);
  return btn as HTMLButtonElement;
}
function click(btn: HTMLElement): void {
  act(() => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

const FAKE_STREAM = { getTracks: () => [] } as unknown as MediaStream;

function fakeFrame(): CapturedFrame {
  return {
    blob: new Blob(['x'], { type: 'image/webp' }),
    widthPx: 1000,
    heightPx: 1400,
    blur: { variance: 240, sharp: true } as CapturedFrame['blur'],
  };
}
const CALIB: ScaleFromMarkerOutput = {
  pixelsPerMm: 4,
  rmsCalibrationError: 1.2,
  homography: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  silhouette_bbox_px: { x: 0, y: 0, width: 400, height: 600 },
} as unknown as ScaleFromMarkerOutput;
const DIMS = {
  dimensionsMm: { width: 100, depth: 80, height: 120 },
  typedVsMeasured: { deltaPct: 0.01, flagged: false },
};

// ─── prepare step: PDF fetch failure recovers, never dead-ends ────────────
describe('prepare step — reference PDF fetch failure', () => {
  it('surfaces an error with retry + continue, then continues to the camera step', async () => {
    const failingFetch = vi.fn(async () => ({ ok: false, status: 500 } as unknown as Response));
    render(
      <CaptureModal
        merchantSlug="k1" merchantId={1}
        onClose={() => {}}
        initialStep="prepare"
        __testFetch={failingFetch as unknown as typeof fetch}
      />,
    );
    click(buttonByText('Open reference PDF'));
    await flushAsync();

    expect(container.textContent).toMatch(/Reference page unavailable/i);
    // Recover actions present — no dead end.
    expect(() => buttonByText('Retry')).not.toThrow();
    const continueBtn = buttonByText('I already printed it');

    click(continueBtn);
    // Advanced to the camera step (front-photo guidance shows).
    expect(container.querySelector('[aria-current="step"]')?.textContent).toBe('camera');
    expect(container.textContent).toMatch(/Front photo/i);
  });
});

// ─── camera step: permission denied recovers ──────────────────────────────
describe('camera step — permission/availability error', () => {
  it('renders the error with a Try again recover action (no real camera)', async () => {
    // jsdom has no navigator.mediaDevices → camera-unavailable path.
    render(<CameraStage onCapture={() => {}} onCancel={() => {}} />);
    await flushAsync();
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toMatch(/Camera not available|Camera permission needed/i);
    expect(() => buttonByText('Try again')).not.toThrow();
  });
});

// ─── shots step: front/side/back tiles + guidance + continue ──────────────
describe('shots step — optional side/back capture', () => {
  it('renders all three slots with guidance and a continue action', () => {
    render(
      <ShotSet
        frontFrameUrl="blob:front"
        side={null} sideUrl={null}
        back={null} backUrl={null}
        onCapture={() => {}}
        onRemove={() => {}}
        onRetakeFront={() => {}}
        onContinue={() => {}}
        onBack={() => {}}
        __testStream={FAKE_STREAM}
      />,
    );
    expect(container.textContent).toMatch(/Front photo/);
    expect(container.textContent).toMatch(/Side photo/);
    expect(container.textContent).toMatch(/Back photo/);
    expect(() => buttonByText('Add side')).not.toThrow();
    expect(() => buttonByText('Add back')).not.toThrow();
    expect(() => buttonByText('Continue to review')).not.toThrow();
  });

  it('opens the camera with side guidance when "Add side" is tapped', () => {
    render(
      <ShotSet
        frontFrameUrl="blob:front"
        side={null} sideUrl={null}
        back={null} backUrl={null}
        onCapture={() => {}}
        onRemove={() => {}}
        onRetakeFront={() => {}}
        onContinue={() => {}}
        onBack={() => {}}
        __testStream={FAKE_STREAM}
      />,
    );
    click(buttonByText('Add side'));
    // CameraStage now mounted with the side guidance banner.
    expect(container.querySelector('[aria-label="Camera capture stage"]')).not.toBeNull();
    expect(container.textContent).toMatch(/Turn the product 90/i);
  });
});

// ─── review step: gating + side/back ride into the packet ─────────────────
describe('review step — reconcile gating + optional shots in packet', () => {
  it('disables Submit and shows the reason when the set is incomplete', () => {
    render(
      <ReviewSubmit
        merchantSlug="k1" merchantId={1}
        frontFrame={fakeFrame()} frontFrameUrl="blob:front"
        calibration={CALIB} dimensions={DIMS}
        blockedReason="Capture the front photo first."
        onComplete={() => {}} onBack={() => {}} onCancel={() => {}}
      />,
    );
    expect(buttonByText('Submit').disabled).toBe(true);
    expect(container.textContent).toMatch(/Capture the front photo first/i);
  });

  it('submits the front shot and carries the side shot into the calibrate packet', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, method: init?.method ?? 'GET', body: init?.body as string | undefined });
      if (init?.method === 'PUT') {
        return { ok: true, status: 200, headers: { get: () => null } } as unknown as Response;
      }
      if (u.includes('sign-upload')) {
        return {
          ok: true, status: 200, headers: { get: () => null },
          json: async () => ({ uploadUrl: 'https://blob.example/up', token: 't', blobKey: 'k', expiresAt: '2030-01-01' }),
        } as unknown as Response;
      }
      if (u.includes('calibrate')) {
        return {
          ok: true, status: 200, headers: { get: () => null },
          json: async () => ({ scaleLockId: '11111111-1111-4111-8111-111111111111' }),
        } as unknown as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
    });

    render(
      <ReviewSubmit
        merchantSlug="k1" merchantId={1}
        frontFrame={fakeFrame()} frontFrameUrl="blob:front"
        sideFrame={fakeFrame()} sideFrameUrl="blob:side"
        calibration={CALIB} dimensions={DIMS}
        onComplete={() => {}} onBack={() => {}} onCancel={() => {}}
        __testFetch={mockFetch as unknown as typeof fetch}
      />,
    );

    // Two photos previewed (front + side).
    expect(container.textContent).toMatch(/2 photos/i);

    click(buttonByText('Submit'));
    await flushAsync(12);

    expect(container.textContent).toMatch(/Scale-lock minted/i);
    // Front + side both uploaded (2 sign-upload + 2 PUT) and calibrate fired.
    const signCalls = calls.filter((c) => c.url.includes('sign-upload'));
    expect(signCalls.length).toBe(2);
    const calibrateCall = calls.find((c) => c.url.includes('calibrate'));
    expect(calibrateCall?.body).toMatch(/photoSide/);
  });
});
