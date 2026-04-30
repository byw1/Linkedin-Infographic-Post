"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

// Lightweight shadcn-style <Input>. Inlined here so the component
// is self-contained and drop-in copy-pasteable. Project already
// uses similar utility-class inputs elsewhere.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

interface Props {
  // Show the "Sign in with Google" button. The page only passes
  // true when the admin has configured Google OAuth in /admin/auth.
  googleEnabled?: boolean;
}

// Animated glass sign-in card. Visual treatment is the same indigo
// aurora + traveling light-beams + 3D mouse-tilt as the brand
// (matches the OG share image and the welcome page); the auth side
// uses our existing next-auth flow.
export function SignInCard2({ googleEnabled = false }: Props) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [focusedInput, setFocusedInput] = useState<"email" | "password" | null>(
    null,
  );

  // 3D card tilt — mouseX/Y track relative to the card center, then
  // we map ±300px → ±10deg rotation. Gives the card a subtle parallax
  // feel as the cursor moves across it.
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [10, -10]);
  const rotateY = useTransform(mouseX, [-300, 300], [-10, 10]);

  function handleMouseMove(e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid email or password.");
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black">
      {/* Background gradient — indigo aurora to match brand (same
        * palette as the OG share image and the /welcome hero). */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/35 via-indigo-700/45 to-black" />

      {/* Subtle SVG noise overlay so the gradient doesn't band. */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-soft-light"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      {/* Soft glows top + bottom for depth. */}
      <div className="absolute left-1/2 top-0 h-[60vh] w-[120vh] -translate-x-1/2 transform rounded-b-[50%] bg-indigo-400/20 blur-[80px]" />
      <motion.div
        className="absolute left-1/2 top-0 h-[60vh] w-[100vh] -translate-x-1/2 transform rounded-b-full bg-indigo-300/20 blur-[60px]"
        animate={{ opacity: [0.15, 0.3, 0.15], scale: [0.98, 1.02, 0.98] }}
        transition={{ duration: 8, repeat: Infinity, repeatType: "mirror" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/2 h-[90vh] w-[90vh] -translate-x-1/2 transform rounded-t-full bg-violet-500/20 blur-[60px]"
        animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.1, 1] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          repeatType: "mirror",
          delay: 1,
        }}
      />
      <div className="absolute left-1/4 top-1/4 h-96 w-96 animate-pulse rounded-full bg-white/5 opacity-40 blur-[100px]" />
      <div className="absolute right-1/4 bottom-1/4 h-96 w-96 animate-pulse rounded-full bg-white/5 opacity-40 blur-[100px] delay-1000" />

      {/* Back-to-home overlay. Lives outside the centered card so it
        * stays pinned to the top-left on every viewport size. Higher
        * z-index than the card glow but below any modal would be. */}
      <Link
        href="/welcome"
        className="absolute left-6 top-6 z-20 inline-flex h-9 items-center rounded-md border border-white/15 bg-black/30 px-3 text-xs text-white/80 backdrop-blur-md transition-colors hover:border-white/30 hover:bg-black/50 hover:text-white"
      >
        ← Back to home
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-sm px-4"
        style={{ perspective: 1500 }}
      >
        <motion.div
          className="relative"
          style={{ rotateX, rotateY }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          whileHover={{ z: 10 }}
        >
          <div className="group relative">
            {/* Outer card glow — pulses on hover. */}
            <motion.div
              className="absolute -inset-[1px] rounded-2xl opacity-0 transition-opacity duration-700 group-hover:opacity-70"
              animate={{
                boxShadow: [
                  "0 0 10px 2px rgba(255,255,255,0.03)",
                  "0 0 15px 5px rgba(255,255,255,0.05)",
                  "0 0 10px 2px rgba(255,255,255,0.03)",
                ],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
                repeatType: "mirror",
              }}
            />

            {/* Traveling light beams running around the card edge. */}
            <div className="absolute -inset-[1px] overflow-hidden rounded-2xl">
              <motion.div
                className="absolute top-0 left-0 h-[3px] w-[50%] bg-gradient-to-r from-transparent via-white to-transparent opacity-70"
                initial={{ filter: "blur(2px)" }}
                animate={{
                  left: ["-50%", "100%"],
                  opacity: [0.3, 0.7, 0.3],
                  filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"],
                }}
                transition={{
                  left: {
                    duration: 2.5,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 1,
                  },
                  opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror" },
                  filter: { duration: 1.5, repeat: Infinity, repeatType: "mirror" },
                }}
              />
              <motion.div
                className="absolute top-0 right-0 h-[50%] w-[3px] bg-gradient-to-b from-transparent via-white to-transparent opacity-70"
                initial={{ filter: "blur(2px)" }}
                animate={{
                  top: ["-50%", "100%"],
                  opacity: [0.3, 0.7, 0.3],
                  filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"],
                }}
                transition={{
                  top: {
                    duration: 2.5,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 1,
                    delay: 0.6,
                  },
                  opacity: {
                    duration: 1.2,
                    repeat: Infinity,
                    repeatType: "mirror",
                    delay: 0.6,
                  },
                  filter: {
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "mirror",
                    delay: 0.6,
                  },
                }}
              />
              <motion.div
                className="absolute bottom-0 right-0 h-[3px] w-[50%] bg-gradient-to-r from-transparent via-white to-transparent opacity-70"
                initial={{ filter: "blur(2px)" }}
                animate={{
                  right: ["-50%", "100%"],
                  opacity: [0.3, 0.7, 0.3],
                  filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"],
                }}
                transition={{
                  right: {
                    duration: 2.5,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 1,
                    delay: 1.2,
                  },
                  opacity: {
                    duration: 1.2,
                    repeat: Infinity,
                    repeatType: "mirror",
                    delay: 1.2,
                  },
                  filter: {
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "mirror",
                    delay: 1.2,
                  },
                }}
              />
              <motion.div
                className="absolute bottom-0 left-0 h-[50%] w-[3px] bg-gradient-to-b from-transparent via-white to-transparent opacity-70"
                initial={{ filter: "blur(2px)" }}
                animate={{
                  bottom: ["-50%", "100%"],
                  opacity: [0.3, 0.7, 0.3],
                  filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"],
                }}
                transition={{
                  bottom: {
                    duration: 2.5,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 1,
                    delay: 1.8,
                  },
                  opacity: {
                    duration: 1.2,
                    repeat: Infinity,
                    repeatType: "mirror",
                    delay: 1.8,
                  },
                  filter: {
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "mirror",
                    delay: 1.8,
                  },
                }}
              />

              {/* Corner pinpoint glows. */}
              <motion.div
                className="absolute top-0 left-0 h-[5px] w-[5px] rounded-full bg-white/40 blur-[1px]"
                animate={{ opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 2, repeat: Infinity, repeatType: "mirror" }}
              />
              <motion.div
                className="absolute top-0 right-0 h-[8px] w-[8px] rounded-full bg-white/60 blur-[2px]"
                animate={{ opacity: [0.2, 0.4, 0.2] }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  repeatType: "mirror",
                  delay: 0.5,
                }}
              />
              <motion.div
                className="absolute bottom-0 right-0 h-[8px] w-[8px] rounded-full bg-white/60 blur-[2px]"
                animate={{ opacity: [0.2, 0.4, 0.2] }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  repeatType: "mirror",
                  delay: 1,
                }}
              />
              <motion.div
                className="absolute bottom-0 left-0 h-[5px] w-[5px] rounded-full bg-white/40 blur-[1px]"
                animate={{ opacity: [0.2, 0.4, 0.2] }}
                transition={{
                  duration: 2.3,
                  repeat: Infinity,
                  repeatType: "mirror",
                  delay: 1.5,
                }}
              />
            </div>

            <div className="absolute -inset-[0.5px] rounded-2xl bg-gradient-to-r from-white/3 via-white/7 to-white/3 opacity-0 transition-opacity duration-500 group-hover:opacity-70" />

            {/* Glass card body */}
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.05] bg-black/40 p-6 shadow-2xl backdrop-blur-xl">
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)",
                  backgroundSize: "30px 30px",
                }}
              />

              {/* Header with brand mark */}
              <div className="mb-5 space-y-1 text-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", duration: 0.8 }}
                  className="relative mx-auto flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10"
                >
                  <BarsLogo />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-b from-white to-white/80 bg-clip-text text-xl font-bold text-transparent"
                >
                  Welcome back
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-xs text-white/60"
                >
                  Sign in to keep shipping on viral
                </motion.p>
              </div>

              {/* Form */}
              <form onSubmit={submit} className="space-y-4">
                <motion.div className="space-y-3">
                  {/* Email */}
                  <motion.div
                    className={`relative ${focusedInput === "email" ? "z-10" : ""}`}
                    whileHover={{ scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <div className="absolute -inset-[0.5px] rounded-lg bg-gradient-to-r from-white/10 via-white/5 to-white/10 opacity-0 transition-all duration-300 group-hover:opacity-100" />
                    <div className="relative flex items-center overflow-hidden rounded-lg">
                      <Mail
                        className={`absolute left-3 h-4 w-4 transition-all duration-300 ${
                          focusedInput === "email" ? "text-white" : "text-white/40"
                        }`}
                      />
                      <Input
                        type="email"
                        placeholder="Email address"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setFocusedInput("email")}
                        onBlur={() => setFocusedInput(null)}
                        className="h-10 w-full border-transparent bg-white/5 pl-10 pr-3 text-white placeholder:text-white/30 transition-all duration-300 focus:border-white/20 focus:bg-white/10"
                      />
                      {focusedInput === "email" && (
                        <motion.div
                          layoutId="input-highlight"
                          className="absolute inset-0 -z-10 bg-white/5"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        />
                      )}
                    </div>
                  </motion.div>

                  {/* Password */}
                  <motion.div
                    className={`relative ${focusedInput === "password" ? "z-10" : ""}`}
                    whileHover={{ scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <div className="absolute -inset-[0.5px] rounded-lg bg-gradient-to-r from-white/10 via-white/5 to-white/10 opacity-0 transition-all duration-300 group-hover:opacity-100" />
                    <div className="relative flex items-center overflow-hidden rounded-lg">
                      <Lock
                        className={`absolute left-3 h-4 w-4 transition-all duration-300 ${
                          focusedInput === "password"
                            ? "text-white"
                            : "text-white/40"
                        }`}
                      />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setFocusedInput("password")}
                        onBlur={() => setFocusedInput(null)}
                        className="h-10 w-full border-transparent bg-white/5 pl-10 pr-10 text-white placeholder:text-white/30 transition-all duration-300 focus:border-white/20 focus:bg-white/10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 cursor-pointer text-white/40 transition-colors duration-300 hover:text-white"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </button>
                      {focusedInput === "password" && (
                        <motion.div
                          layoutId="input-highlight"
                          className="absolute inset-0 -z-10 bg-white/5"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        />
                      )}
                    </div>
                  </motion.div>
                </motion.div>

                {/* Remember-me row was here but the checkbox was
                  * decorative — JWT sessions already last 60 days
                  * by default (see lib/auth.ts session.maxAge), so
                  * everyone is "remembered". Removed to avoid a
                  * UI that suggests behavior it doesn't have. */}

                {/* Error */}
                {error && (
                  <p className="text-center text-xs text-red-300">{error}</p>
                )}

                {/* Submit */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={pending}
                  className="group/button relative mt-5 w-full"
                >
                  <div className="absolute inset-0 rounded-lg bg-white/10 opacity-0 blur-lg transition-opacity duration-300 group-hover/button:opacity-70" />
                  <div className="relative flex h-10 items-center justify-center overflow-hidden rounded-lg bg-white font-medium text-black transition-all duration-300">
                    <motion.div
                      className="absolute inset-0 -z-10 bg-gradient-to-r from-white/0 via-white/30 to-white/0"
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{
                        duration: 1.5,
                        ease: "easeInOut",
                        repeat: Infinity,
                        repeatDelay: 1,
                      }}
                      style={{
                        opacity: pending ? 1 : 0,
                        transition: "opacity 0.3s ease",
                      }}
                    />
                    <AnimatePresence mode="wait">
                      {pending ? (
                        <motion.div
                          key="loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center justify-center"
                        >
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/70 border-t-transparent" />
                        </motion.div>
                      ) : (
                        <motion.span
                          key="button-text"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center justify-center gap-1 text-sm font-medium"
                        >
                          Sign in
                          <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover/button:translate-x-1" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.button>

                {/* Divider + Google (only when admin enabled it) */}
                {googleEnabled && (
                  <>
                    <div className="relative mt-2 mb-5 flex items-center">
                      <div className="flex-grow border-t border-white/5" />
                      <motion.span
                        className="mx-3 text-xs text-white/40"
                        initial={{ opacity: 0.7 }}
                        animate={{ opacity: [0.7, 0.9, 0.7] }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        or
                      </motion.span>
                      <div className="flex-grow border-t border-white/5" />
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() =>
                        signIn("google", { callbackUrl: "/" })
                      }
                      className="group/google relative w-full"
                    >
                      <div className="absolute inset-0 rounded-lg bg-white/5 opacity-0 blur transition-opacity duration-300 group-hover/google:opacity-70" />
                      <div className="relative flex h-10 items-center justify-center gap-2 overflow-hidden rounded-lg border border-white/10 bg-white/5 font-medium text-white transition-all duration-300 hover:border-white/20">
                        <GoogleG />
                        <span className="text-xs text-white/80 transition-colors group-hover/google:text-white">
                          Sign in with Google
                        </span>
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0"
                          initial={{ x: "-100%" }}
                          whileHover={{ x: "100%" }}
                          transition={{ duration: 1, ease: "easeInOut" }}
                        />
                      </div>
                    </motion.button>
                  </>
                )}

                {/* Bottom CTA — invite-only, no public signup. */}
                <motion.p
                  className="mt-4 text-center text-xs text-white/60"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  No account?{" "}
                  <Link
                    href="/welcome/request"
                    className="group/signup relative inline-block"
                  >
                    <span className="relative z-10 font-medium text-white transition-colors duration-300 group-hover/signup:text-white/70">
                      Request access
                    </span>
                    <span className="absolute bottom-0 left-0 h-[1px] w-0 bg-white transition-all duration-300 group-hover/signup:w-full" />
                  </Link>
                </motion.p>
              </form>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

// Brand mark — same rising-bars logo as /public/logo.svg + the
// favicon, inlined so the card stays self-contained.
function BarsLogo() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
      <rect x={3} y={14} width={4} height={7} rx={1} fill="#a5b4fc" />
      <rect x={10} y={9} width={4} height={12} rx={1} fill="#818cf8" />
      <rect x={17} y={4} width={4} height={17} rx={1} fill="#6366f1" />
    </svg>
  );
}

// Multi-color Google "G" — lucide doesn't ship a Google logo, so
// inline the official asset. Brand colors only; outer wrapper handles
// hover state.
function GoogleG() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.51h3.232c1.891-1.74 2.981-4.305 2.981-7.35z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.964-.895 6.619-2.422l-3.232-2.51c-.895.6-2.04.955-3.387.955-2.605 0-4.81-1.76-5.596-4.123H3.064v2.59A9.997 9.997 0 0 0 12 22z"
        fill="#34A853"
      />
      <path
        d="M6.404 13.9A6.005 6.005 0 0 1 6.09 12c0-.659.114-1.3.314-1.9V7.51H3.064A9.997 9.997 0 0 0 2 12c0 1.614.386 3.14 1.064 4.49l3.34-2.59z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.96 2.99 14.695 2 12 2 8.09 2 4.71 4.245 3.064 7.51l3.34 2.59C7.19 7.736 9.395 5.977 12 5.977z"
        fill="#EA4335"
      />
    </svg>
  );
}
