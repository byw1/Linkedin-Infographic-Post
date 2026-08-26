"use client";

// Flickering-grid footer. The canvas tints a grid of squares to
// reveal whatever text we render on a hidden mask canvas — squares
// inside the text glyphs draw at higher opacity than squares
// outside, so the word "fades in" out of static. CPU-only, no
// shader, ~negligible cost while in view (IntersectionObserver
// pauses the loop when the footer scrolls offscreen).
//
// Source layout dropped the compliance-badge stack + multi-column
// nav from the upstream component since they don't apply here —
// just brand block + social icons + the grid below.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Color from "color-bits";
import { Github, Globe, Instagram, Linkedin } from "lucide-react";
import { Asterisk } from "@/components/ui/asterisk";
import { cn } from "@/lib/utils";

// Resolve any CSS color (hex, rgb, hsl, var(--…)) to an rgba string
// the canvas can splat directly. SSR-safe — returns the fallback
// when there's no window.
function getRGBA(
  cssColor: React.CSSProperties["color"],
  fallback = "rgba(180, 180, 180)",
): string {
  if (typeof window === "undefined") return fallback;
  if (!cssColor) return fallback;
  try {
    if (typeof cssColor === "string" && cssColor.startsWith("var(")) {
      const el = document.createElement("div");
      el.style.color = cssColor;
      document.body.appendChild(el);
      const resolved = window.getComputedStyle(el).color;
      document.body.removeChild(el);
      return Color.formatRGBA(Color.parse(resolved));
    }
    return Color.formatRGBA(Color.parse(cssColor));
  } catch {
    return fallback;
  }
}

function colorWithOpacity(color: string, opacity: number): string {
  if (!color.startsWith("rgb")) return color;
  return Color.formatRGBA(Color.alpha(Color.parse(color), opacity));
}

interface FlickeringGridProps extends React.HTMLAttributes<HTMLDivElement> {
  squareSize?: number;
  gridGap?: number;
  flickerChance?: number;
  color?: string;
  width?: number;
  height?: number;
  className?: string;
  maxOpacity?: number;
  text?: string;
  fontSize?: number;
  fontWeight?: number | string;
}

export const FlickeringGrid: React.FC<FlickeringGridProps> = ({
  squareSize = 3,
  gridGap = 3,
  flickerChance = 0.2,
  color = "#B4B4B4",
  width,
  height,
  className,
  maxOpacity = 0.15,
  text = "",
  fontSize = 140,
  fontWeight = 600,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const memoizedColor = useMemo(() => getRGBA(color), [color]);

  const drawGrid = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      cols: number,
      rows: number,
      squares: Float32Array,
      dpr: number,
    ) => {
      ctx.clearRect(0, 0, width, height);

      // Mask canvas — text glyphs render here in white; their alpha
      // becomes the boost we apply when drawing each square. The
      // mask is recreated each frame because resizing changes the
      // canvas dimensions.
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = width;
      maskCanvas.height = height;
      const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
      if (!maskCtx) return;

      if (text) {
        maskCtx.save();
        maskCtx.scale(dpr, dpr);
        maskCtx.fillStyle = "white";
        maskCtx.font = `${fontWeight} ${fontSize}px "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        maskCtx.textAlign = "center";
        maskCtx.textBaseline = "middle";
        maskCtx.fillText(text, width / (2 * dpr), height / (2 * dpr));
        maskCtx.restore();
      }

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * (squareSize + gridGap) * dpr;
          const y = j * (squareSize + gridGap) * dpr;
          const sw = squareSize * dpr;
          const sh = squareSize * dpr;

          const data = maskCtx.getImageData(x, y, sw, sh).data;
          const hasText = data.some((v, idx) => idx % 4 === 0 && v > 0);
          const opacity = squares[i * rows + j];
          const finalOpacity = hasText ? Math.min(1, opacity * 3 + 0.4) : opacity;

          ctx.fillStyle = colorWithOpacity(memoizedColor, finalOpacity);
          ctx.fillRect(x, y, sw, sh);
        }
      }
    },
    [memoizedColor, squareSize, gridGap, text, fontSize, fontWeight],
  );

  const setupCanvas = useCallback(
    (canvas: HTMLCanvasElement, width: number, height: number) => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const cols = Math.ceil(width / (squareSize + gridGap));
      const rows = Math.ceil(height / (squareSize + gridGap));
      const squares = new Float32Array(cols * rows);
      for (let i = 0; i < squares.length; i++) {
        squares[i] = Math.random() * maxOpacity;
      }
      return { cols, rows, squares, dpr };
    },
    [squareSize, gridGap, maxOpacity],
  );

  const updateSquares = useCallback(
    (squares: Float32Array, deltaTime: number) => {
      for (let i = 0; i < squares.length; i++) {
        if (Math.random() < flickerChance * deltaTime) {
          squares[i] = Math.random() * maxOpacity;
        }
      }
    },
    [flickerChance, maxOpacity],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let gridParams: ReturnType<typeof setupCanvas>;

    const updateCanvasSize = () => {
      const w = width || container.clientWidth;
      const h = height || container.clientHeight;
      setCanvasSize({ width: w, height: h });
      gridParams = setupCanvas(canvas, w, h);
    };
    updateCanvasSize();

    let lastTime = 0;
    const animate = (time: number) => {
      if (!isInView) return;
      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;
      updateSquares(gridParams.squares, deltaTime);
      drawGrid(
        ctx,
        canvas.width,
        canvas.height,
        gridParams.cols,
        gridParams.rows,
        gridParams.squares,
        gridParams.dpr,
      );
      raf = requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(updateCanvasSize);
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0 },
    );
    intersectionObserver.observe(canvas);

    if (isInView) raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [setupCanvas, updateSquares, drawGrid, width, height, isInView]);

  return (
    <div
      ref={containerRef}
      className={cn("h-full w-full", className)}
      {...props}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none"
        style={{ width: canvasSize.width, height: canvasSize.height }}
      />
    </div>
  );
};

function useMediaQuery(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatch(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return match;
}

// Shifu Labs is the parent brand; Viral is one of its tools. Change
// this in one place if the domain settles differently.
// Note the domain is singular while the brand name is plural: the link
// is shifulab.com, the wordmark stays "Shifu Labs".
const SHIFU_URL = "https://shifulab.com";
const SHIFU_LABEL = SHIFU_URL.replace(/^https?:\/\//, "");

const SOCIALS = [
  {
    label: "LinkedIn",
    href: "https://linkedin.com/in/bywilliaml",
    Icon: Linkedin,
  },
  {
    label: "Instagram",
    href: "https://instagram.com/bywilliaml",
    Icon: Instagram,
  },
  {
    label: "Website",
    href: "https://bywilliaml.com",
    Icon: Globe,
  },
  {
    label: "GitHub",
    href: "https://github.com/byw1",
    Icon: Github,
  },
];

export function FlickeringFooter() {
  const tablet = useMediaQuery("(max-width: 1024px)");

  return (
    <footer id="footer" className="w-full pb-0">
      <div className="flex flex-col items-start justify-between gap-8 p-10 md:flex-row md:items-center">
        {/* Brand */}
        <div className="flex max-w-md flex-col items-start gap-4">
          <a href="/welcome" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" aria-hidden className="h-7 w-7" />
            <span className="text-xl font-semibold tracking-tight">Viral</span>
          </a>
          <p className="text-sm text-muted-foreground">
            Making our friends famous, one platform at a time.
          </p>
          <a
            href={SHIFU_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Asterisk
              size={14}
              className="text-signal transition-transform duration-300 group-hover:rotate-90"
            />
            <span>
              A <span className="font-semibold text-foreground">Shifu Labs</span>{" "}
              tool
            </span>
          </a>
          <div className="flex items-center gap-2">
            {SOCIALS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title={label}
                aria-label={label}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground hover:text-foreground cursor-pointer active:scale-[0.97] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 shadow-sm"
              >
                <Icon className="h-4 w-4" aria-hidden />
              </a>
            ))}
          </div>
        </div>

        {/* Credit. Shifu Labs leads; William keeps the byline. */}
        <div className="flex flex-col gap-1 text-xs text-muted-foreground md:items-end">
          <a
            href={SHIFU_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground underline decoration-signal underline-offset-4 hover:text-signal"
          >
            {SHIFU_LABEL}
          </a>
          <p>
            Built by{" "}
            <a
              href="https://bywilliaml.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              @bywilliaml
            </a>
          </p>
        </div>
      </div>

      {/* Animated grid block — renders the handle in flickering pixels.
        * Smaller font + tighter grid on tablet/phone so it doesn't
        * truncate. Gradient overlay fades the top edge into the page. */}
      <div className="relative z-0 mt-12 h-48 w-full md:h-64">
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-transparent to-background from-40%" />
        <div className="absolute inset-0 mx-6">
          <FlickeringGrid
            text="SHIFU LABS"
            fontSize={tablet ? 70 : 110}
            className="h-full w-full"
            squareSize={2}
            gridGap={tablet ? 2 : 3}
            color="#FF4D00"
            maxOpacity={0.45}
            flickerChance={0.1}
          />
        </div>
      </div>
    </footer>
  );
}
