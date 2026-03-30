import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import "../animations.css";

/**
 * PageSweep — a cleaning-themed sweep overlay that plays on every navigation.
 * Renders a translucent green gradient bar that wipes left→right across the full
 * viewport, giving the feel of a mop or squeegee clearing the screen.
 * Must be rendered inside <BrowserRouter>.
 */
export function PageSweep() {
  const { pathname } = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Remove the class and force a reflow so the animation re-triggers
    el.classList.remove("sweeping");
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    void el.offsetWidth;
    el.classList.add("sweeping");
  }, [pathname]);

  return <div ref={ref} className="page-sweep-overlay" aria-hidden="true" />;
}
