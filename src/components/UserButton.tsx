"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signout } from "@/lib/auth-client";
import { LogOut, LayoutDashboard, Shield } from "lucide-react";

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
    return <div className="ub-av is-loading" aria-hidden="true" />;
  }

  if (!session?.user) {
    return null;
  }

  const email = session.user.email ?? "";
  const name = session.user.name || session.user.username || email;
  const initial = (name[0] || "U").toUpperCase();
  const isRoot = (session.user.role ?? 0) >= 100;

  const handleSignOut = async () => {
    try {
      await signout();
    } catch (err) {
      console.error("Signout error:", err);
    }
    window.location.href = "/";
  };

  return (
    <div className="ub" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="ub-av"
        aria-label="User profile menu"
        aria-expanded={open}
      >
        {initial}
      </button>

      {open && (
        <div className="ub-menu">
          <div className="ub-head">
            <p className="ub-name">{name}</p>
            <p className="ub-email">{email}</p>
          </div>

          <div className="ub-list">
            <Link href="/dashboard" onClick={() => setOpen(false)} className="ub-item">
              <LayoutDashboard size={14} />
              Dashboard
            </Link>
            {isRoot ? (
              <Link href="/admin" onClick={() => setOpen(false)} className="ub-item">
                <Shield size={14} />
                Admin
              </Link>
            ) : null}
          </div>

          <div className="ub-foot">
            <button type="button" onClick={handleSignOut} className="ub-out">
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
