import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CityProcurementPlanSchema, createCityProcurementPlan, type CityProcurementPlan, type CityProcurementPackage } from '../designer/cityProcurement';

export interface CityProcurementCloudRef { merchantSlug: string; revision: number; savedAt: string }
interface CityProcurementState {
  plans: Record<string, CityProcurementPlan>;
  cloud: Record<string, CityProcurementCloudRef>;
  ensurePlan(projectId: string, name: string): CityProcurementPlan;
  setPlan(plan: CityProcurementPlan): void;
  upsertPackage(projectId: string, pkg: CityProcurementPackage): void;
  removePackage(projectId: string, packageId: string): void;
  removePlan(projectId: string): void;
  setCloud(projectId: string, ref: CityProcurementCloudRef): void;
}
/** Private local planning data: deliberately never embedded in Property or cloud-design exports. */
export const useCityProcurementStore = create<CityProcurementState>()(persist((set, get) => ({
  plans: {}, cloud: {},
  ensurePlan(projectId, name) {
    const plans = get().plans;
    const existing = Object.prototype.hasOwnProperty.call(plans, projectId) ? plans[projectId] : undefined;
    if (existing) return existing;
    const plan = createCityProcurementPlan(projectId, name);
    set(state => ({ plans: { ...state.plans, [projectId]: plan } }));
    return plan;
  },
  setPlan(input) {
    const plan = CityProcurementPlanSchema.parse(input);
    set(state => {
      const cloud = { ...state.cloud };
      if (state.plans[plan.projectId]?.id !== plan.id) delete cloud[plan.projectId];
      return { plans: { ...state.plans, [plan.projectId]: plan }, cloud };
    });
  },
  upsertPackage(projectId, pkg) {
    const plan = get().plans[projectId];
    if (!plan) throw new Error('Create the project procurement plan first.');
    get().setPlan({ ...plan, packages: plan.packages.some(item => item.id === pkg.id) ? plan.packages.map(item => item.id === pkg.id ? pkg : item) : [...plan.packages, pkg] });
  },
  removePackage(projectId, packageId) {
    const plan = get().plans[projectId];
    if (plan) get().setPlan({ ...plan, packages: plan.packages.filter(pkg => pkg.id !== packageId) });
  },
  removePlan(projectId) {
    set(state => {
      const plans = { ...state.plans }; const cloud = { ...state.cloud };
      delete plans[projectId]; delete cloud[projectId]; return { plans, cloud };
    });
  },
  setCloud(projectId, ref) { set(state => ({ cloud: { ...state.cloud, [projectId]: ref } })); },
}), {
  name: 'ppw_city_procurement_v1', storage: createJSONStorage(() => localStorage),
  merge(persisted, current) {
    const raw = persisted && typeof persisted === 'object' ? persisted as { plans?: Record<string, unknown>; cloud?: Record<string, unknown> } : {};
    const plans: Record<string, CityProcurementPlan> = {}; const cloud: Record<string, CityProcurementCloudRef> = {};
    for (const [key, value] of Object.entries(raw.plans ?? {})) {
      const result = CityProcurementPlanSchema.safeParse(value);
      if (result.success && result.data.projectId === key) plans[key] = result.data;
    }
    for (const [key, value] of Object.entries(raw.cloud ?? {})) {
      const ref = value as Partial<CityProcurementCloudRef> | null;
      if (plans[key] && ref && typeof ref.merchantSlug === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(ref.merchantSlug) && Number.isSafeInteger(ref.revision) && ref.revision! > 0 && typeof ref.savedAt === 'string') cloud[key] = ref as CityProcurementCloudRef;
    }
    return { ...current, plans, cloud };
  },
}));
