"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signout } from "@/lib/auth-client";
import { LogOut, LayoutDashboard, User as UserIcon } from "lucide-react";

export function UserButton() {
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isPending) {
    return <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />;
  }

  if (!session?.user) {
    return null;
  }

  const email = session.user.email ?? "";
  const name = session.user.name || session.user.username || email;
  const initial = (name[0] || "U").toUpperCase();

  const handleSignOut = async () => {
    try {
      await signout();
    } catch (err) {
      console.error("Signout error:", err);
    }
    window.location.href = "/";
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-semibold text-xs flex items-center justify-center hover:bg-emerald-500/30 transition-all cursor-pointer"
        aria-label="User profile menu"
        aria-expanded={open}
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#14171f] border border-white/10 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-4 py-2 border-b border-white/5">
            <p className="text-sm font-medium text-white truncate">{name}</p>
            <p className="text-xs text-white/50 truncate">{email}</p>
          </div>

          <div className="py-1">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs text-white/80 hover:bg-white/5 hover:text-white transition-colors"
            >
              <LayoutDashboard size={14} className="text-white/60" />
              Dashboard
            </Link>
          </div>

          <div className="border-t border-white/5 pt-1">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
