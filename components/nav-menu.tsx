"use client";

import Link from "next/link";
import { useRef } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Settings as SettingsIcon, LogOut, ShieldCheck } from "lucide-react";

interface Props {
  email: string | null | undefined;
  isAdmin: boolean;
  // Server action passed in from the parent (server) component so this
  // client component doesn't need to import server-only auth code.
  signOutAction: () => Promise<void>;
}

export function NavMenu({ email, isAdmin, signOutAction }: Props) {
  // Hidden form lets us submit the server action from outside the
  // dropdown's render tree. Radix `DropdownMenu.Item` closes the
  // menu (and unmounts its children) on select, which races the
  // inner form's submit event — the form was unmounted before
  // submission completed, so the sign-out call never went out.
  // Submitting a sibling form via requestSubmit() side-steps that.
  const signOutFormRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={signOutFormRef} action={signOutAction} className="hidden" />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Settings menu"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-40 min-w-[12rem] overflow-hidden rounded-md border bg-card p-1 text-card-foreground shadow-lg"
          >
            {email && (
              <div className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                {email}
              </div>
            )}
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item asChild>
              <Link
                href="/settings"
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-secondary"
              >
                <SettingsIcon className="h-3.5 w-3.5" />
                Settings
              </Link>
            </DropdownMenu.Item>
            {isAdmin && (
              <DropdownMenu.Item asChild>
                <Link
                  href="/admin"
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-secondary"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Admin
                </Link>
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item
              onSelect={(e) => {
                // Prevent Radix from closing the menu before submit
                // fires; requestSubmit posts to the hidden form which
                // outlives the dropdown's unmount.
                e.preventDefault();
                signOutFormRef.current?.requestSubmit();
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none focus:bg-secondary"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  );
}
