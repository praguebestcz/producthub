// Umístění bubliny nového komentáře v ploše prohlížeče dokumentu.
//
// Čistá funkce (testovatelná bez DOM). Souřadnice chodí z overlaye uvnitř
// iframu jako VIEWPORT souřadnice; iframe vyplňuje kontejner v rodiči, takže
// se rovnají souřadnicím v kontejneru a nepřevádějí se.
//
// Dvě pravidla, na kterých záleží (obojí byla zpětná vazba Hany):
//  1) bublina patří k MÍSTU KLIKNUTÍ, ne pod celý prvek — u velkého prvku
//     (diagram, dlouhá sekce) by jinak skončila stovky pixelů daleko,
//  2) bublina musí být VŽDY celá vidět — jinak zůstane tlačítko „Odeslat"
//     pod okrajem a uživatel se k němu nedostane.

export type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
};

export type Point = { x: number; y: number };

export function computeBubblePosition({
  point,
  rect,
  container,
  bubbleWidth,
  bubbleHeight,
  margin = 8,
  gap = 12,
}: {
  // Bod kliknutí uvnitř dokumentu. Když chybí (starší zpráva z overlaye),
  // použije se prvek.
  point: Point | null;
  rect: Rect;
  container: { width: number; height: number };
  bubbleWidth: number;
  bubbleHeight: number;
  margin?: number;
  gap?: number;
}): { left: number; top: number; maxHeight: number } {
  // Kolik výšky je vůbec k dispozici — bublina nikdy nesmí být vyšší.
  const maxHeight = Math.max(0, container.height - 2 * margin);
  const height = Math.min(bubbleHeight, maxHeight);

  // Svislý kotevní bod: místo kliknutí, jinak spodní hrana prvku.
  const anchorTop = point ? point.y : rect.top;
  const anchorBottom = point ? point.y : rect.bottom;

  // Nejdřív pod kotvu; když se tam nevejde a nad ní je víc místa, nad ni.
  let top = anchorBottom + gap;
  if (top + height > container.height - margin) {
    const above = anchorTop - gap - height;
    if (above >= margin) top = above;
  }
  // Pojistka: ať výpočet dopadne jakkoli, bublina zůstane celá v ploše.
  top = clamp(top, margin, container.height - height - margin);

  // Vodorovně: začít u kotvy a nevylézt z kontejneru.
  const anchorLeft = point ? point.x : rect.left;
  const left = clamp(anchorLeft, margin, container.width - bubbleWidth - margin);

  return { left, top, maxHeight };
}

// Když je kontejner menší než bublina, dolní mez vyjde nad horní — pak vyhrává
// horní okraj (bublina začne nahoře a doroluje se uvnitř).
function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(value, max));
}
