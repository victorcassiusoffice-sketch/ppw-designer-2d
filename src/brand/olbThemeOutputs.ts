/** Which stylesheets get a generated One Live Build override, and where it is written (repo-relative). */
export const OLB_THEME_OUTPUTS = [
  { output: 'src/pages/pitch/pitch.olb.generated.css', sources: ['src/pages/pitch/pitch.css', 'src/pages/pitch/pitch-tactile.css'] },
  { output: 'src/pages/sales/salesPack.olb.generated.css', sources: ['src/pages/sales/salesPack.css'] },
] as const;
