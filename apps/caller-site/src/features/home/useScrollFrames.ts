"use client";

import { useEffect, useState, type RefObject } from "react";
import type { MotionValue } from "framer-motion";

const FRAME_COUNT = 160;
const FRAME_WIDTH = 1920;
const FRAME_HEIGHT = 1080;
const CACHE_RADIUS = 6;
const CONCURRENT_LOADS = 3;
const frameSrc = (index: number) =>
  `/scroll-frames/frame-${String(index).padStart(3, "0")}.webp?v=1080-lossless`;

/** Decode a small window of original-resolution frames around the scroll position. */
export function useScrollFrames(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  skipRef: RefObject<HTMLButtonElement | null>,
  progress: MotionValue<number>,
) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const frames = new Map<number, ImageBitmap>();
    const pending = new Map<number, AbortController>();
    const failed = new Set<number>();
    let active = true;
    let visible = true;
    let desired = 0;
    let direction = 1;
    let lastDrawn = -1;
    let raf = 0;
    let dirty = true;
    let hasDrawn = false;

    function wanted() {
      const indices = [desired];
      for (let distance = 1; distance <= CACHE_RADIUS; distance++) {
        for (const index of [desired + distance * direction, desired - distance * direction]) {
          if (index >= 0 && index < FRAME_COUNT) indices.push(index);
        }
      }
      return indices;
    }

    function schedule() {
      if (active && visible && !document.hidden && !raf) raf = requestAnimationFrame(draw);
    }

    function loadNearby() {
      if (!active || !visible || document.hidden) return;
      for (const index of wanted()) {
        if (pending.size >= CONCURRENT_LOADS) break;
        if (frames.has(index) || pending.has(index) || failed.has(index)) continue;
        const controller = new AbortController();
        pending.set(index, controller);
        void (async () => {
          try {
            const response = await fetch(frameSrc(index), {
              signal: controller.signal,
              cache: "force-cache",
            });
            if (!response.ok) throw new Error(`Frame ${index}: ${response.status}`);
            const bitmap = await createImageBitmap(await response.blob());
            if (!active || controller.signal.aborted || !wanted().includes(index)) {
              bitmap.close();
            } else {
              frames.set(index, bitmap);
            }
          } catch {
            if (!controller.signal.aborted) failed.add(index);
          } finally {
            pending.delete(index);
            schedule();
          }
        })();
      }
      // Keep the page usable even if none of the nearby assets are available.
      if (!hasDrawn && !pending.size && wanted().every((index) => failed.has(index))) {
        setLoaded(true);
      }
    }

    function draw() {
      raf = 0;
      if (!active) return;
      loadNearby();
      // Hold the nearest decoded frame while the requested one loads; never clear
      // a good frame for a network request or an undecoded image.
      let nearest = -1;
      for (const index of frames.keys()) {
        if (nearest < 0 || Math.abs(index - desired) < Math.abs(nearest - desired)) nearest = index;
      }
      const image = frames.get(nearest);
      if (!image || (!dirty && nearest === lastDrawn)) return;
      const scale = Math.max(canvas!.width / image.width, canvas!.height / image.height);
      const x = (canvas!.width - image.width * scale) / 2;
      const y = (canvas!.height - image.height * scale) / 2;
      ctx!.imageSmoothingEnabled = true;
      ctx!.imageSmoothingQuality = "high";
      ctx!.drawImage(image, x, y, image.width * scale, image.height * scale);
      canvas!.dataset.frame = String(nearest);
      lastDrawn = nearest;
      dirty = false;
      if (!hasDrawn) {
        hasDrawn = true;
        setLoaded(true);
      }
      // Release decoded GPU/CPU surfaces outside the window, keeping only the
      // displayed frame until its replacement is ready (at most 14 bitmaps).
      const keep = wanted();
      for (const [index, bitmap] of frames) {
        if (index !== lastDrawn && !keep.includes(index)) {
          bitmap.close();
          frames.delete(index);
        }
      }
    }

    function update() {
      const index = Math.min(FRAME_COUNT - 1, Math.max(0, Math.floor(progress.get() * (FRAME_COUNT - 1))));
      if (index !== desired) {
        direction = index > desired ? 1 : -1;
        desired = index;
        const keep = wanted();
        for (const [index, controller] of pending) {
          if (!keep.includes(index)) controller.abort();
        }
        for (const [index, bitmap] of frames) {
          if (index !== lastDrawn && !keep.includes(index)) {
            bitmap.close();
            frames.delete(index);
          }
        }
      }
      schedule();
    }

    function resize() {
      const width = canvas!.clientWidth;
      const height = canvas!.clientHeight;
      if (!width || !height) return;
      // Match the display density up to the detail present in the source. Avoid
      // allocating a huge retina canvas that only magnifies the same pixels.
      const density = Math.min(window.devicePixelRatio || 1, FRAME_WIDTH / width, FRAME_HEIGHT / height);
      canvas!.width = Math.round(width * density);
      canvas!.height = Math.round(height * density);
      dirty = true;
      const scale = Math.max(width / FRAME_WIDTH, height / FRAME_HEIGHT);
      const mx = (width - FRAME_WIDTH * scale) / 2 + 0.9068 * FRAME_WIDTH * scale;
      const my = (height - FRAME_HEIGHT * scale) / 2 + 0.8343 * FRAME_HEIGHT * scale;
      const onScreen = mx > 0 && mx < width && my > 0 && my < height;
      if (skipRef.current) {
        skipRef.current.style.height = `${Math.max(44, Math.round(0.0375 * FRAME_WIDTH * scale * 1.35))}px`;
        skipRef.current.style.left = `${onScreen ? mx : width - 72}px`;
        skipRef.current.style.top = `${onScreen ? my : height - 40}px`;
      }
      update();
    }

    const unsubscribe = progress.on("change", update);
    const sizes = new ResizeObserver(resize);
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) update();
    });
    sizes.observe(canvas);
    seen.observe(canvas);
    document.addEventListener("visibilitychange", update);
    resize();

    return () => {
      active = false;
      cancelAnimationFrame(raf);
      unsubscribe();
      sizes.disconnect();
      seen.disconnect();
      document.removeEventListener("visibilitychange", update);
      for (const controller of pending.values()) controller.abort();
      for (const bitmap of frames.values()) bitmap.close();
      frames.clear();
    };
  }, [canvasRef, skipRef, progress]);

  return loaded;
}
