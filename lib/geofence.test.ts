import { describe, it, expect } from "vitest";
import { isPointInPolygon, isWithinBeyoglu, BEYOGLU_CENTER } from "./geofence";

const square: [number, number][] = [
  [0, 0],
  [0, 1],
  [1, 1],
  [1, 0],
  [0, 0],
];

describe("isPointInPolygon", () => {
  it("içerideki noktayı true döner", () => {
    expect(isPointInPolygon([0.5, 0.5], square)).toBe(true);
  });

  it("dışarıdaki noktayı false döner", () => {
    expect(isPointInPolygon([2, 2], square)).toBe(false);
    expect(isPointInPolygon([-0.5, 0.5], square)).toBe(false);
  });
});

describe("isWithinBeyoglu", () => {
  it("Beyoğlu merkezi sınır içinde", () => {
    // BEYOGLU_CENTER = [lng, lat]; isWithinBeyoglu(lat, lng) sırasıyla.
    expect(isWithinBeyoglu(BEYOGLU_CENTER[1], BEYOGLU_CENTER[0])).toBe(true);
  });

  it("uzak bir nokta (Ankara) sınır dışında", () => {
    expect(isWithinBeyoglu(39.92, 32.85)).toBe(false);
  });
});
