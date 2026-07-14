import { describe, it, expect } from "vitest";
import { polygonArea, polygonCentroid, getRingBounds, type Ring } from "./geo";

// Birim kare (kapalı halka). Sıra saat yönünde; alan/centroid işaretten bağımsız.
const unitSquare: Ring = [
  [0, 0],
  [0, 1],
  [1, 1],
  [1, 0],
  [0, 0],
];

describe("polygonArea", () => {
  it("birim karenin alanı 1", () => {
    expect(polygonArea(unitSquare)).toBeCloseTo(1, 10);
  });

  it("halka yönünden bağımsız (mutlak alan)", () => {
    const reversed: Ring = [...unitSquare].reverse() as Ring;
    expect(polygonArea(reversed)).toBeCloseTo(1, 10);
  });
});

describe("polygonCentroid", () => {
  it("birim karenin merkezi (0.5, 0.5)", () => {
    const [cx, cy] = polygonCentroid(unitSquare);
    expect(cx).toBeCloseTo(0.5, 10);
    expect(cy).toBeCloseTo(0.5, 10);
  });

  it("dejenere (sıfır alan) poligonda ortalamaya düşer", () => {
    const line: Ring = [
      [0, 0],
      [2, 0],
      [0, 0],
    ];
    const [cx, cy] = polygonCentroid(line);
    expect(cx).toBeCloseTo(1, 10);
    expect(cy).toBeCloseTo(0, 10);
  });
});

describe("getRingBounds", () => {
  it("min/max lng-lat'ı doğru bulur", () => {
    const ring: Ring = [
      [28.97, 41.02],
      [29.01, 41.05],
      [28.95, 41.06],
      [28.97, 41.02],
    ];
    expect(getRingBounds(ring)).toEqual({
      minLng: 28.95,
      minLat: 41.02,
      maxLng: 29.01,
      maxLat: 41.06,
    });
  });
});
