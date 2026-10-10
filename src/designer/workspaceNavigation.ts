import { useDesignerUIStore } from '../store/designerUIStore';
import { usePropertyStore } from '../store/propertyStore';

type WorkspaceKind = 'foundation' | 'services';
let active: WorkspaceKind | null = null;
let origin: 'plan' | '3d' = 'plan';
let projectId: string | null = null;

/** A chain of specialist workspaces returns to the view that opened the chain. */
export function beginWorkspaceNavigation(kind: WorkspaceKind) {
  const currentProject = usePropertyStore.getState().property.id;
  if (active === null || projectId !== currentProject) origin = useDesignerUIStore.getState().viewMode;
  projectId = currentProject;
  active = kind;
}
/** A different project or unrelated modal owns its own return path. */
export function cancelWorkspaceNavigation(kind: WorkspaceKind) {
  if (active !== kind) return;
  active = null;
  projectId = null;
}
export function finishWorkspaceNavigation(kind: WorkspaceKind) {
  if (active !== kind) return;
  const restore = projectId === usePropertyStore.getState().property.id;
  cancelWorkspaceNavigation(kind);
  if (restore) useDesignerUIStore.getState().setViewMode(origin);
}
