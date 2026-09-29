"use client";

import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * The app-wide toast host.
 *
 * Mounted once in the root layout so any client component can call
 * `toast.success()` / `toast.error()` without wiring its own state.
 *
 * Sonner reads its palette from CSS variables on the toaster element;
 * the inline `style` below maps them onto the site's tokens. It is
 * inline rather than a stylesheet because sonner injects its own sheet
 * at runtime and inline declarations are the only guaranteed override.
 * The sharp corners match --corner: 0 used everywhere else.
 */
const palette = {
  "--normal-bg": "#fffefb",
  "--normal-text": "var(--ink, #14110f)",
  "--normal-border": "color-mix(in srgb, var(--ink, #14110f) 12%, transparent)",

  "--success-bg": "color-mix(in srgb, var(--ok, #1bb673) 10%, #fffefb)",
  "--success-border": "color-mix(in srgb, var(--ok, #1bb673) 32%, transparent)",
  "--success-text": "color-mix(in srgb, var(--ok, #1bb673) 72%, #14110f)",

  "--error-bg": "color-mix(in srgb, #b91c1c 8%, #fffefb)",
  "--error-border": "color-mix(in srgb, #b91c1c 30%, transparent)",
  "--error-text": "#b91c1c",

  "--warning-bg": "color-mix(in srgb, var(--amber, #f97316) 12%, #fffefb)",
  "--warning-border": "color-mix(in srgb, var(--amber, #f97316) 34%, transparent)",
  "--warning-text": "color-mix(in srgb, var(--amber-deep, #c2410c) 90%, #14110f)",

  "--info-bg": "color-mix(in srgb, var(--ink, #14110f) 6%, #fffefb)",
  "--info-border": "color-mix(in srgb, var(--ink, #14110f) 16%, transparent)",
  "--info-text": "var(--ink, #14110f)",

  "--border-radius": "0px",
} as CSSProperties;

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="vip-toaster"
      position="top-center"
      duration={5000}
      closeButton
      richColors
      style={palette}
      {...props}
    />
  );
}
