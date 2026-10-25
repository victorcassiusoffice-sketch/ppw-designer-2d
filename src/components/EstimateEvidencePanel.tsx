import type { Property } from '../store/propertyStore';
import { getProductById } from '../data/products';
import { useCatalogStore } from '../store/catalogStore';
import { assessEstimateEvidence } from '../designer/estimateEvidence';
import './estimateEvidencePanel.css';

export function EstimateEvidencePanel({ property }: { property: Property }) {
  // Reuse the existing arrival signal; this panel never starts a catalogue request.
  useCatalogStore(state => state.version);
  const evidence = assessEstimateEvidence(property, getProductById);
  return <details className="estimate-evidence" data-testid="estimate-evidence">
    <summary><span><strong>Estimate evidence</strong><small>Inputs, calculation scope and verification</small></span><span className="estimate-evidence-count">{evidence.engines.length} modules</span></summary>
    <div className="estimate-evidence-body">
      <ol className="estimate-evidence-flow" aria-label="Estimation workflow"><li>Measured inputs</li><li>Quantity engines</li><li>Review & quote</li></ol>
      <div className="estimate-evidence-stat"><strong>{evidence.inputCoverage.present} / {evidence.inputCoverage.total}</strong><span>Input checks present</span></div>
      <p>Presence only. These checks do not measure estimate accuracy or engineering approval.</p>
      <ul className="estimate-evidence-checks">{evidence.checks.map(check => <li key={check.id}><div><strong>{check.label}</strong><span data-status={check.status}>{check.status === 'present' ? 'Present' : check.status === 'not-used' ? 'Not used' : 'Review'}</span></div><p>{check.detail}</p></li>)}</ul>
      <section className="estimate-evidence-validation" aria-label="Independent validation"><strong>Independent validation · not available</strong><p>{evidence.empiricalAccuracy.reason}</p><p>{evidence.sources.engineeringReferences} engineering document references recorded. Contents and approval remain unverified.</p></section>
      <details className="estimate-engine-inventory"><summary>Explore the {evidence.engines.length} calculation modules</summary><p>Distinct code modules, with shared inputs and helpers. This inventory is not a certification or a claim that every module runs on this project.</p>{evidence.engines.map(engine => <details key={engine.id} className="estimate-engine"><summary>{engine.name}</summary><dl><dt>Inputs</dt><dd>{engine.inputs}</dd><dt>Calculates</dt><dd>{engine.output}</dd><dt>Evidence basis</dt><dd>{engine.sourceBasis}</dd><dt>Limits</dt><dd>{engine.limit}</dd></dl></details>)}</details>
    </div>
  </details>;
}
