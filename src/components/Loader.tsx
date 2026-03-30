import "../animations.css";

interface LoaderProps {
  /** "sm" for inline/compact, "md" (default) for cards, "lg" for full-page centers */
  size?: "sm" | "md" | "lg";
  text?: string;
}

/**
 * Loader — three bouncing dots in brand colour.
 * Replaces the old rotating circle spinner everywhere.
 */
export function Loader({ size = "md", text }: LoaderProps) {
  const dotSize = size === "sm" ? "w-1.5 h-1.5" : size === "lg" ? "w-3 h-3" : "w-2.5 h-2.5";
  const gap = size === "sm" ? "gap-1" : "gap-1.5";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`sweep-loader ${size === "sm" ? "sweep-loader-sm" : ""}`}>
        <span className={`dot ${dotSize}`} />
        <span className={`dot ${dotSize}`} />
        <span className={`dot ${dotSize}`} />
      </div>
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}

/**
 * PageLoader — full-page centered loader for when a page is fetching initial data.
 * Drop-in replacement for the old `<div className="animate-spin ...rounded-full">` pattern.
 */
export function PageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="sweep-loader">
        <span className="dot w-3 h-3" />
        <span className="dot w-3 h-3" />
        <span className="dot w-3 h-3" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/**
 * CardLoader — compact centered loader inside a card (replaces p-12 text-center spinner).
 */
export function CardLoader({ text }: { text?: string }) {
  return (
    <div className="p-12 text-center flex flex-col items-center gap-4">
      <div className="sweep-loader">
        <span className="dot w-2.5 h-2.5" />
        <span className="dot w-2.5 h-2.5" />
        <span className="dot w-2.5 h-2.5" />
      </div>
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}
