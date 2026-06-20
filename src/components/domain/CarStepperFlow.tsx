/**
 * CarStepperFlow — guided slot-based car configurator (DESIGNER-EXPANSION P4).
 *
 * The car domain uses `placement: 'stepper'` (no free placement): the buyer
 * steps through option groups (model → trim → paint → wheels → seats →
 * infotainment → packages) filling ONE slot per step. The slot-set + base
 * vehicle come from the P3 `getDefaultSpace('car')` `VehicleConfigSpace`
 * template; the options per step come from the P2 mock car catalog.
 *
 * This is a config FLOW (P4). The 3D turntable render is P5. State is local
 * to the flow — nothing here touches the wellness propertyStore.
 */
import { useMemo, useState } from 'react';
import { getDefaultSpace } from '../../lib/domain';
import type { VehicleConfigSpace } from '../../lib/domain';
import { categoryLabel } from '../../lib/domain/categories';
import { getAllProducts } from '../../data/products';
import type { CarCategory, CarProduct } from '../../data/products.schema';

/** The ordered slot keys = the stepper's steps (template slot-set order). */
function stepOrder(space: VehicleConfigSpace): CarCategory[] {
  return Object.keys(space.slots) as CarCategory[];
}

export function CarStepperFlow(): JSX.Element {
  // Fresh template per mount (deep-cloned by getDefaultSpace).
  const initialSpace = useMemo(() => getDefaultSpace('car') as VehicleConfigSpace, []);
  const steps = useMemo(() => stepOrder(initialSpace), [initialSpace]);
  const carProducts = useMemo(() => getAllProducts('car') as CarProduct[], []);

  const [slots, setSlots] = useState<Record<CarCategory, string | null>>(
    () => ({ ...initialSpace.slots }),
  );
  const [stepIndex, setStepIndex] = useState(0);

  const currentStep = steps[stepIndex];
  const options = useMemo(
    () => carProducts.filter((p) => p.category === currentStep),
    [carProducts, currentStep],
  );
  const chosenId = slots[currentStep];

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  function choose(productId: string): void {
    setSlots((s) => ({ ...s, [currentStep]: productId }));
  }

  return (
    <section
      data-testid="car-stepper-flow"
      className="car-stepper-flow"
      aria-label="Car configurator"
    >
      <ol className="car-stepper-progress" data-testid="car-stepper-progress">
        {steps.map((step, i) => (
          <li
            key={step}
            aria-current={i === stepIndex ? 'step' : undefined}
            data-filled={slots[step] ? 'true' : 'false'}
            className={
              i === stepIndex
                ? 'car-step is-active'
                : slots[step]
                  ? 'car-step is-done'
                  : 'car-step'
            }
          >
            {categoryLabel('car', step)}
          </li>
        ))}
      </ol>

      <div className="car-stepper-body">
        <h3 data-testid="car-step-title">
          Step {stepIndex + 1} of {steps.length}: {categoryLabel('car', currentStep)}
        </h3>

        <ul className="car-step-options" data-testid="car-step-options">
          {options.length === 0 ? (
            <li className="car-step-empty" data-testid="car-step-empty">
              No options seeded for this step yet.
            </li>
          ) : (
            options.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  data-testid={`car-option-${p.id}`}
                  aria-pressed={chosenId === p.id}
                  className={
                    chosenId === p.id ? 'car-option is-chosen' : 'car-option'
                  }
                  onClick={() => choose(p.id)}
                >
                  <span className="car-option-name">{p.name}</span>
                  <span className="car-option-price">
                    {p.price.currency} {p.price.value.toLocaleString()}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <nav className="car-stepper-nav" aria-label="Configurator steps">
        <button
          type="button"
          data-testid="car-step-back"
          disabled={isFirst}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
        >
          Back
        </button>
        <button
          type="button"
          data-testid="car-step-next"
          disabled={isLast}
          onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
        >
          Next
        </button>
      </nav>
    </section>
  );
}
