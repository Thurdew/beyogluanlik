import { describe, it, expect } from "vitest";
import { haversineMeters } from "./distance";

describe("haversineMeters", () => {
  it("aynı nokta için 0 döner", () => {
    expect(haversineMeters(41.035, 28.978, 41.035, 28.978)).toBe(0);
  });

  it("1° enlem farkı ~111 km'dir", () => {
    const d = haversineMeters(41, 29, 42, 29);
    expect(d).toBeGreaterThan(111000);
    expect(d).toBeLessThan(111400);
  });

  it("~0.001° enlem farkı ~111 m'dir (duplicate yarıçapı ölçeği)", () => {
    const d = haversineMeters(41.0, 29.0, 41.001, 29.0);
    expect(d).toBeCloseTo(111.2, 0);
  });

  it("simetriktir: d(a,b) === d(b,a)", () => {
    const ab = haversineMeters(41.03, 28.97, 41.04, 28.99);
    const ba = haversineMeters(41.04, 28.99, 41.03, 28.97);
    expect(ab).toBeCloseTo(ba, 6);
  });
});
