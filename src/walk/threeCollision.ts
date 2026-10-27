// BVH needs Triangle, which the existing first-picture renderer did not use.
// Keep that implementation deferred; all shared scene types keep one identity.
export * from 'three';
export { Triangle } from 'three/src/math/Triangle.js';
