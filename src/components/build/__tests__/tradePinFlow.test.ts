// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useTradeFlow, type JobForm } from '../tradeFlow';

const draft: JobForm = {
  id: 'shower-work',
  projectId: 'site-a',
  role: 'plumbing',
  existing: false,
  title: 'Fit shower mixer',
  note: 'Check wall first',
  status: 'started',
  by: 'Taylor',
  startDate: '',
  dueDate: '',
  pin: null,
  photo: null,
};
const pin = { levelId: 'ground', planRef: 'olb:wall:bath.0', x: 2, y: 3, z: 1.2 };
afterEach(() => {
  useTradeFlow.getState().scope('reset');
});
describe('field form returns from the actual model', () => {
  it('restores the unfinished form, anchors it once and reopens the trade station without writing a record', () => {
    const opened = vi.fn(),
      storage = vi.spyOn(Storage.prototype, 'setItem');
    window.addEventListener('olb:open-project', opened);
    try {
      const api = useTradeFlow.getState();
      api.scope(draft.projectId);
      api.setRole('plumbing');
      api.beginPick(draft.projectId, draft);
      api.finishPick(pin);
      api.finishPick({ ...pin, x: 9 });
      expect(opened).toHaveBeenCalledTimes(1);
      expect(opened.mock.calls[0][0].detail.section).toBe('buildDashboard');
      expect(useTradeFlow.getState()).toMatchObject({
        mode: 'off',
        role: 'plumbing',
        form: { ...draft, pin },
      });
      expect(storage).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('olb:open-project', opened);
      storage.mockRestore();
    }
  });
  it('preserves the old pin on cancel and discards a draft when the project changes', () => {
    const api = useTradeFlow.getState();
    api.scope('site-a');
    api.beginPick('site-a', { ...draft, pin });
    api.returnToDashboard();
    expect(useTradeFlow.getState().form?.pin).toEqual(pin);
    api.scope('site-b');
    expect(useTradeFlow.getState()).toMatchObject({
      form: null,
      pin: null,
      projectId: 'site-b',
      mode: 'off',
      role: 'owner',
    });
  });
});
