// Sims-Parity DT-20 — minimal ambient declaration for the js-aruco2
// runtime. The package ships no .d.ts; we only consume the AR.Detector
// constructor + .detect(ImageData) → markers shape.
declare module 'js-aruco2' {
  export const AR: {
    Detector: new () => {
      detect(image: ImageData): Array<{ id: number; corners: Array<{ x: number; y: number }> }>;
    };
  };
  const _default: { AR: typeof AR };
  export default _default;
}
