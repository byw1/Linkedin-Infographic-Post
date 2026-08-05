"use client";

import Link from "next/link";
import { useRef } from "react";
import { LogOut, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverDescription,
  PopoverFooter,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  email: string | null | undefined;
  name: string | null | undefined;
  image: string | null | undefined;
  isAdmin: boolean;
  // Server action passed in from the parent (server) component so this
  // client component doesn't need to import server-only auth code.
  signOutAction: () => Promise<void>;
}

// Profile-button → popover. Replaces the old gear-icon dropdown
// with the user's avatar — clicking opens a popover that shows
// who's signed in plus quick links to Settings, Admin (if the
// viewer is one), and Sign out. Cleaner than the gear since it
// doubles as a "you're signed in as X" affordance.
export function NavMenu({
  email,
  name,
  image,
  isAdmin,
  signOutAction,
}: Props) {
  // Hidden form lets us submit the server action without unmounting
  // the popover at the wrong moment — same pattern the old menu
  // used. Sign-out submit fires on form, popover closes naturally.
  const signOutFormRef = useRef<HTMLFormElement>(null);
  const initials = displayInitials(name, email);
  const displayName = name?.trim() || email?.split("@")[0] || "Account";

  return (
    <>
      <form ref={signOutFormRef} action={signOutAction} className="hidden" />
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Account menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-background text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={image}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span className="uppercase">{initials}</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={6} className="w-60 p-0">
          <PopoverHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-secondary text-sm font-medium uppercase text-muted-foreground">
                {image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0 flex-1">
                <PopoverTitle className="truncate text-sm">
                  {displayName}
                </PopoverTitle>
                {email && (
                  <PopoverDescription className="truncate text-xs">
                    {email}
                  </PopoverDescription>
                )}
              </div>
            </div>
          </PopoverHeader>

          <PopoverBody className="space-y-0.5 px-2 py-2">
            <MenuLink href="/settings" icon={<SettingsIcon className="h-3.5 w-3.5" />}>
              Settings
            </MenuLink>
            {isAdmin && (
              <MenuLink href="/admin" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                Admin
              </MenuLink>
            )}
          </PopoverBody>

          <PopoverFooter className="px-2 py-2">
            <button
              type="button"
              onClick={() => signOutFormRef.current?.requestSubmit()}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border bg-transparent text-sm font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all duration-200 active:scale-[0.97] outline-none ring-offset-0 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 shadow-sm"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </PopoverFooter>
        </PopoverContent>
      </Popover>
    </>
  );
}

function MenuLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
    >
      {icon}
      {children}
    </Link>
  );
}

function displayInitials(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const source = (name ?? email ?? "").trim();
  if (!source) return "?";
  const parts = source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}
