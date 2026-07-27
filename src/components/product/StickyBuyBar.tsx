"use client";

import { useEffect, useState } from "react";

import { euro } from "@/lib/format";

/**
 * Mobiele koopbalk: verschijnt onderaan zodra de bestelknop boven het scherm
 * is weggescrold, en scrolt terug naar die knop. Alleen op kleine schermen;
 * op desktop staat het koopblok altijd in beeld.
 */
export function StickyBuyBar({
  name,
  price,
  targetId,
}: {
  name: string;
  price: number;
  targetId: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const target = document.getElementById(targetId);
      if (!target) return;
      setVisible(target.getBoundingClientRect().bottom <= 0);
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(check);
    };

    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    // Vangnet voor sprongen zonder scroll-event (scroll restore, hash-links).
    // Meet hier direct: zonder frames draait een rAF-callback niet.
    let observer: IntersectionObserver | undefined;
    const target = document.getElementById(targetId);
    if (target) {
      observer = new IntersectionObserver(check, { threshold: 0 });
      observer.observe(target);
    }

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [targetId]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-white/95 p-3 shadow-lift backdrop-blur sm:hidden">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-bold text-ink">{name}</p>
          <p className="font-black text-brand">{euro(price)}</p>
        </div>
        <button
          type="button"
          onClick={() =>
            document.getElementById(targetId)?.scrollIntoView({ block: "center" })
          }
          className="btn btn-primary shrink-0 px-6"
        >
          Bestellen
        </button>
      </div>
    </div>
  );
}
