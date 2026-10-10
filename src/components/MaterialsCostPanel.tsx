import type { MaterialsReport, MaterialsSettings } from '../designer/materials';
import { estimateMaterialCosts, setMaterialRate, type ProcurementLine } from '../designer/materials/costs';

export function MaterialsCostPanel({ report, additions = [], incompleteReasons = [], save }: { report: MaterialsReport; additions?: ProcurementLine[]; incompleteReasons?: string[]; save: (settings: MaterialsSettings) => void }) {
  const cost = estimateMaterialCosts(report, additions, incompleteReasons);
  return <div className="materials-fields" aria-label="Material quotation rates">
    <p className="materials-note">Enter your supplier quotation in MUR per stated unit, on one consistent tax basis. Empty means unpriced. Only purchase quantities are costed; ingredient and total rows are not added twice.</p>
    <label className="materials-field"><span>Quotation tax basis</span><select aria-label="Quotation tax basis" value={report.settings.quotationTaxBasis ?? ''} onChange={event => {
      const next = { ...report.settings };
      if (event.target.value === 'inclusive' || event.target.value === 'exclusive') next.quotationTaxBasis = event.target.value;
      else delete next.quotationTaxBasis;
      save(next);
    }}><option value="">Select before entering rates</option><option value="inclusive">All rates include tax</option><option value="exclusive">All rates exclude tax</option></select></label>
    <strong>{cost.complete ? 'Entered-rate material estimate' : 'Known material subtotal'}: {cost.knownSubtotalMur === null ? 'Unavailable' : `${cost.knownSubtotalMur.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MUR`}</strong>
    {cost.incompleteReasons.map(reason => <p className="materials-note" role="status" key={reason}>{reason}</p>)}
    <p>{cost.unpricedLines} unpriced line{cost.unpricedLines === 1 ? '' : 's'}. {cost.lines.length === 0 && 'Draw walls or enable a concrete estimate to start.'}</p>
    {cost.lines.map(line => <label className="materials-field" key={line.id}>
      <span>{line.label} · {line.quantity.toLocaleString('en-GB', { maximumFractionDigits: 3 })} {line.unit}</span>
      <input key={`${line.id}-${line.specification}-${line.unitRateMur}`} type="number" min="0" max="1000000000" step="0.01" aria-label={`${line.label} rate MUR per ${line.unit}`} placeholder="Quote required" defaultValue={line.unitRateMur ?? ''} disabled={!report.settings.quotationTaxBasis}
        onBlur={event => {
          const value = event.currentTarget.value;
          if (value === '') save(setMaterialRate(report.settings, line, null));
          else if (Number.isFinite(event.currentTarget.valueAsNumber) && event.currentTarget.valueAsNumber >= 0 && event.currentTarget.valueAsNumber <= 1e9) save(setMaterialRate(report.settings, line, event.currentTarget.valueAsNumber));
          else event.currentTarget.value = line.unitRateMur === null ? '' : String(line.unitRateMur);
        }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
      <small>{line.needsReview ? 'Specification or tax basis changed: review and re-enter this rate.' : line.totalMur === null ? 'Not included in known subtotal' : `${line.totalMur.toFixed(2)} MUR`}</small>
    </label>)}
    <p className="materials-note">{cost.basis}</p>
  </div>;
}
