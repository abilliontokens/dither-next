"use client"

import { type RefObject, useEffect, useRef } from "react"

/**
 * Run a self-scheduling animation loop only while its host element is near
 * the viewport. The docs page mounts dozens of demo loops and an offscreen
 * loop still costs a frame per tick — measured at ~440 rAF/s from the idle
 * text/animation demos alone, pure main-thread and battery waste.
 *
 * Contract: `start` must be idempotent (the observer keeps firing while the
 * element stays visible) and must not be called optimistically at mount —
 * the first intersection observation decides, matching the chart-root rule in
 * the kit contracts. Reduced-motion gating stays in the caller's `start`.
 * Without IntersectionObserver (jsdom, ancient engines) the loop starts
 * immediately, which is the old always-on behaviour — so existing tests and
 * degraded environments are unaffected.
 *
 * React port of the Vue `useInviewLoop` composable: onMounted + onBeforeUnmount
 * collapse into one mount effect (observe in the body, disconnect + stop in the
 * cleanup). `start`/`stop` are read through refs refreshed after every commit,
 * so a caller may pass fresh closures each render without re-subscribing the
 * observer — the Vue setup closures were stable for the component's life.
 */
export function useInviewLoop(
  el: RefObject<HTMLElement | SVGElement | null | undefined>,
  start: () => void,
  stop: () => void,
): void {
  const startRef = useRef(start)
  const stopRef = useRef(stop)
  useEffect(() => {
    startRef.current = start
    stopRef.current = stop
  })
  useEffect(() => {
    const node = el.current
    if (!node || typeof IntersectionObserver === "undefined") {
      startRef.current()
      return () => stopRef.current()
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) startRef.current()
          else stopRef.current()
        }
      },
      { rootMargin: "300px" },
    )
    io.observe(node)
    return () => {
      io.disconnect()
      stopRef.current()
    }
  }, [el])
}
