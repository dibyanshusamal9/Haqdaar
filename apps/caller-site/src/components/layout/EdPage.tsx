"use client";

import { ReactNode, useEffect, useRef } from "react";

/**
 * Wrapper for the editorial pages: scopes the RAAHI-style design system (.ed), reveals
 * .rv blocks as they scroll into view, and drifts the hero art slightly on scroll.
 */
export default function EdPage({ id, children }: { id: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.classList.add("anim");
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.12 },
    );
    const watch = () => el.querySelectorAll(".rv:not(.in)").forEach((n) => observer.observe(n));
    watch();
    // Results and other late content mount after the first pass.
    const mo = new MutationObserver(watch);
    mo.observe(el, { childList: true, subtree: true });

    const art = el.querySelector<HTMLElement>(".hero .bgimg");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onScroll = () => {
      if (art && !reduce) art.style.transform = `translateY(${window.scrollY * 0.18}px)`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      observer.disconnect();
      mo.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div id={id} className="ed" ref={root}>
      {children}
    </div>
  );
}
