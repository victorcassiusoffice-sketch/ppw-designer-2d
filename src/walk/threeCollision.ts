// BVH needs Line3, which the existing first-picture renderer did not use.
// Keep that implementation deferred; all shared scene types keep one identity.
export * from 'three';
export { Line3 } from 'three/src/math/Line3.js';
