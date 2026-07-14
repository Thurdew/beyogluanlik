import { describe, it, expect } from "vitest";
import { clampInterpolate } from "./scale";

describe("clampInterpolate", () => {
  it("orta noktayı doğru orantılar", () => {
    expect(clampInterpolate(15, 10, 20, 0, 100)).toBe(50);
  });

  it("aralık sınırlarında uç değerleri verir", () => {
    expect(clampInterpolate(10, 10, 20, 0, 100)).toBe(0);
    expect(clampInterpolate(20, 10, 20, 0, 100)).toBe(100);
  });

  it("aralık dışını clamp'ler (taşma yok)", () => {
    expect(clampInterpolate(5, 10, 20, 0, 100)).toBe(0);
    expect(clampInterpolate(25, 10, 20, 0, 100)).toBe(100);
  });

  it("azalan çıktı aralığıyla da çalışır", () => {
    expect(clampInterpolate(15, 10, 20, 100, 0)).toBe(50);
  });
});
