import { describe, expect, it } from "vitest";
import {
  computeBubblePosition,
  type Rect,
} from "@/lib/comments/bubble-position";

// Pomocník: rect prvku (viewport souřadnice uvnitř plochy prohlížeče).
function rect(partial: Partial<Rect> = {}): Rect {
  return {
    top: 100,
    left: 100,
    width: 200,
    height: 50,
    bottom: 150,
    right: 300,
    ...partial,
  };
}

const container = { width: 1000, height: 600 };

describe("computeBubblePosition", () => {
  it("otevře bublinu pod bodem kliknutí a zarovná ji s ním", () => {
    const r = computeBubblePosition({
      point: { x: 400, y: 200 },
      rect: rect(),
      container,
      bubbleWidth: 320,
      bubbleHeight: 260,
    });
    expect(r.left).toBe(400);
    expect(r.top).toBe(212); // pod bodem kliknutí (gap 12)
  });

  it("u dolního okraje se otevře nad bodem kliknutí", () => {
    const r = computeBubblePosition({
      point: { x: 400, y: 560 },
      rect: rect({ top: 540, bottom: 580 }),
      container,
      bubbleWidth: 320,
      bubbleHeight: 260,
    });
    // Nad bodem: 560 - 12 - 260 = 288; celá bublina uvnitř kontejneru.
    expect(r.top).toBe(288);
    expect(r.top + 260).toBeLessThanOrEqual(container.height);
  });

  it("u pravého okraje se přisune dovnitř — nikdy nepřeteče doprava", () => {
    const r = computeBubblePosition({
      point: { x: 950, y: 200 },
      rect: rect(),
      container,
      bubbleWidth: 320,
      bubbleHeight: 260,
    });
    expect(r.left + 320).toBeLessThanOrEqual(container.width - 8);
  });

  it("vždy vrátí pozici, ve které je celá bublina uvnitř kontejneru", () => {
    // Bod úplně dole, kde není místo ani nad, ani pod.
    const r = computeBubblePosition({
      point: { x: 10, y: 595 },
      rect: rect({ top: 590, bottom: 600 }),
      container: { width: 1000, height: 300 },
      bubbleWidth: 320,
      bubbleHeight: 260,
    });
    expect(r.top).toBeGreaterThanOrEqual(8);
    expect(r.top + 260).toBeLessThanOrEqual(300);
  });

  it("kontejner nižší než bublina: začne nahoře a omezí výšku (maxHeight)", () => {
    const r = computeBubblePosition({
      point: { x: 100, y: 100 },
      rect: rect(),
      container: { width: 1000, height: 180 },
      bubbleWidth: 320,
      bubbleHeight: 400,
    });
    expect(r.top).toBe(8);
    expect(r.maxHeight).toBe(180 - 16); // obsah se roluje uvnitř bubliny
  });

  it("bez bodu kliknutí (starší overlay) se použije poloha prvku", () => {
    const r = computeBubblePosition({
      point: null,
      rect: rect({ top: 100, left: 150, bottom: 150 }),
      container,
      bubbleWidth: 320,
      bubbleHeight: 200,
    });
    expect(r.left).toBe(150);
    expect(r.top).toBe(162); // pod spodní hranou prvku
  });
});
