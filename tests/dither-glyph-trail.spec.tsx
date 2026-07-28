import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { DitherGlyphTrail } from "../dither-kit/DitherGlyphTrail";

// DitherGlyphTrail - DOM/SVG smoke test. jsdom has no layout (getBoundingClientRect
// returns zeros), so pointer coords land at (0,0); we assert that a stamp is
// spawned and that the glyph SVG (set via dangerouslySetInnerHTML) actually
// renders <rect> children inside each <g>.

describe("DitherGlyphTrail", () => {
  let rafId = 0;
  beforeEach(() => {
    // Stub requestAnimationFrame as a no-op so the lifetime-fade RAF loop
    // never fires - we test the synchronous spawn/throttle/cap contract only.
    // performance.now is controlled per-test via a mutable closure var.
    vi.stubGlobal("requestAnimationFrame", () => ++rafId);
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders children and the SVG overlay", () => {
    const { container, getByText } = render(
      <DitherGlyphTrail>
        <span>child</span>
      </DitherGlyphTrail>
    );
    expect(getByText("child")).toBeInTheDocument();
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("spawns a glyph stamp on pointermove and renders rects via dangerouslySetInnerHTML", () => {
    const now = vi.fn(() => 100);
    performance.now = now as never;

    const { container } = render(
      <DitherGlyphTrail seed={7} color="#ff0000" />
    );
    const div = container.querySelector("div")!;
    // No stamps initially.
    expect(container.querySelectorAll("svg > g").length).toBe(0);

    act(() => {
      fireEvent.pointerMove(div, { clientX: 0, clientY: 0 });
    });

    // One stamp <g> with a transform, containing <rect> glyph pixels.
    const groups = container.querySelectorAll("svg > g");
    expect(groups.length).toBeGreaterThanOrEqual(1);
    const rects = groups[0].querySelectorAll("rect");
    // glyphFromSeed always emits at least the core pixel (a:1).
    expect(rects.length).toBeGreaterThanOrEqual(1);
    expect(rects[0]).toHaveAttribute("fill", "#ff0000");
    expect(rects[0]).toHaveAttribute("width", "4");
    expect(rects[0]).toHaveAttribute("height", "4");
  });

  it("throttles stamps to >=30ms apart", () => {
    let t = 1000;
    const now = vi.fn(() => t);
    performance.now = now as never;

    const { container } = render(<DitherGlyphTrail />);
    const div = container.querySelector("div")!;

    act(() => {
      fireEvent.pointerMove(div, { clientX: 10, clientY: 10 });
    });
    const first = container.querySelectorAll("svg > g").length;

    // Only 5ms later - throttled away.
    t = 1005;
    act(() => {
      fireEvent.pointerMove(div, { clientX: 20, clientY: 20 });
    });
    const second = container.querySelectorAll("svg > g").length;
    expect(second).toBe(first);

    // 31ms later - new stamp.
    t = 1031;
    act(() => {
      fireEvent.pointerMove(div, { clientX: 30, clientY: 30 });
    });
    const third = container.querySelectorAll("svg > g").length;
    expect(third).toBeGreaterThan(first);
  });

  it("caps stamps at maxStamps", () => {
    let t = 0;
    const now = vi.fn(() => t);
    performance.now = now as never;

    const { container } = render(<DitherGlyphTrail maxStamps={3} />);
    const div = container.querySelector("div")!;

    // Spawn 5 stamps, each 40ms apart to clear the throttle.
    for (let i = 0; i < 5; i++) {
      t = i * 40;
      act(() => {
        fireEvent.pointerMove(div, { clientX: i, clientY: i });
      });
    }
    expect(container.querySelectorAll("svg > g").length).toBeLessThanOrEqual(3);
  });

  it("respects prefers-reduced-motion (no stamps)", () => {
    // Override the matchMedia stub to report reduced motion.
    const orig = window.matchMedia;
    // @ts-expect-error override shim
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });

    const { container } = render(<DitherGlyphTrail />);
    const div = container.querySelector("div")!;
    act(() => {
      fireEvent.pointerMove(div, { clientX: 5, clientY: 5 });
    });
    expect(container.querySelectorAll("svg > g").length).toBe(0);

    window.matchMedia = orig;
  });
});
