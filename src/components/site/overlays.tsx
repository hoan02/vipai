"use client";

import dynamic from "next/dynamic";

/**
 * The dialogs and the toast host, split out of the initial bundle.
 *
 * All four are mounted once in the root layout but none renders anything until
 * a visitor acts — a Ctrl/Cmd-K press, a sign-in click, a top-up click, a raised
 * toast. Importing them directly put the keyboard palette's dependency (`cmdk`)
 * and the toast library (`sonner`) in the critical path of every page, including
 * the ones that never open them. `next/dynamic` gives each its own chunk, so
 * `next build` reports them as a separate fetch after hydration instead of
 * part of the first-load script set.
 *
 * `ssr: false` is safe here because they render `null` on the server anyway: the
 * dialogs start closed and the toast host has nothing to show until a message is
 * pushed. The auth bounce (`?auth=signin`) is read on mount, which is after this
 * chunk has loaded.
 */
export const AuthModal = dynamic(
  () => import("./AuthModal").then((module) => module.AuthModal),
  { ssr: false },
);

export const CommandPalette = dynamic(
  () => import("@/components/command-palette").then((module) => module.CommandPalette),
  { ssr: false },
);

export const Toaster = dynamic(
  () => import("@/components/ui/toaster").then((module) => module.Toaster),
  { ssr: false },
);

export const TopUpModal = dynamic(
  () => import("./TopUpModal").then((module) => module.TopUpModal),
  { ssr: false },
);
