/** value'yu [inMin, inMax] aralığından [outMin, outMax] aralığına orantılayıp sınırlar. */
export function clampInterpolate(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  const t = Math.max(0, Math.min(1, (value - inMin) / (inMax - inMin)));
  return outMin + (outMax - outMin) * t;
}
