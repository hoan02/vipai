"use client";

export type AuthMode = "signin" | "signup";

export function openAuthModal(mode: AuthMode = "signin") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("vipai:open-auth", {
        detail: { mode },
      }),
    );
  }
}

export function closeAuthModal() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vipai:close-auth"));
  }
}
