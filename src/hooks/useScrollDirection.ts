import { useState, useEffect } from "react";

export function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("up");
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let lastScrollY = window.pageYOffset;
    let latestScrollY = lastScrollY;
    let rafId = 0;

    const updateScrollDirection = () => {
      latestScrollY = window.pageYOffset;
      if (rafId) return;

      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const currentY = latestScrollY;
        const delta = currentY - lastScrollY;

        if (Math.abs(delta) > 10) {
          const direction = delta > 0 ? "down" : "up";
          setScrollDirection((prev) => (prev === direction ? prev : direction));
        }

        setScrollY((prev) => (prev === currentY ? prev : currentY));
        lastScrollY = currentY > 0 ? currentY : 0;
      });
    };

    window.addEventListener("scroll", updateScrollDirection, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateScrollDirection);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return { scrollDirection, scrollY };
}
