"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type RevealFrom = "left" | "right" | "up" | "down" | "scale";

type RevealProps = {
  children: ReactNode;
  from?: RevealFrom;
  delay?: number;
  className?: string;
  id?: string;
};

export function Reveal({
  children,
  from = "up",
  delay = 0,
  className,
  id,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVisible(true);
      return;
    }

    setArmed(true);

    const show = () => setVisible(true);
    const failsafe = window.setTimeout(show, 1500);

    requestAnimationFrame(() => {
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      if (rect.top < vh * 0.92 && rect.bottom > vh * 0.04) {
        window.setTimeout(show, 120 + delay);
      }
    });

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          show();
          observer.disconnect();
          window.clearTimeout(failsafe);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [delay]);

  const style = { "--reveal-delay": `${delay}ms` } as CSSProperties;

  return (
    <div
      id={id}
      ref={ref}
      className={cn(
        "landing-reveal",
        `landing-reveal-from-${from}`,
        armed && !visible && "landing-reveal-hidden",
        visible && "landing-reveal-visible",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}
