"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  FlaskConical,
  Gauge,
  Home,
  KeyRound,
  ListTodo,
  LogIn,
  LogOut,
  MessageSquare,
  Plug,
  Rocket,
  ScrollText,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  TrendingUp,
  User,
  type LucideIcon,
} from "lucide-react";
import { openAuthModal } from "@/lib/auth-modal";
import { signout, useSession } from "@/lib/auth-client";
import { dashboardNavGroups, type NavIcon } from "@/lib/dashboard-data";

/**
 * A Cmd/Ctrl-K palette over the whole app.
 *
 * The destinations are the same objects the sidebar renders, so a page renamed
 * in one place cannot drift in the other. It is mounted once in the root
 * layout; anything can open it with `openCommandPalette()`, which the
 * dashboard's search button does.
 */

const OPEN_EVENT = "vipai:open-command";

/** Opens the palette from anywhere in the client. */
export function openCommandPalette() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_EVENT));
}

const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  gauge: Gauge,
  flask: FlaskConical,
  chat: MessageSquare,
  bars: BarChart3,
  key: KeyRound,
  scroll: ScrollText,
  audit: ClipboardList,
  tasks: ListTodo,
  credit: CreditCard,
  user: User,
  shield: ShieldCheck,
};

type Destination = { label: string; href: string; icon: LucideIcon; keywords?: string };

const SITE: Destination[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Pricing", href: "/#pricing", icon: Tag },
  { label: "Connect Codex", href: "/download", icon: Download },
  { label: "API docs", href: "/docs", icon: FileText },
];

const DOCS: Destination[] = [
  { label: "Quickstart — Claude Code", href: "/docs/quickstart/claude-code", icon: Rocket },
  { label: "API integration", href: "/docs/api-integration", icon: Plug },
  { label: "Models", href: "/docs/models", icon: Boxes },
  { label: "Billing", href: "/docs/billing", icon: CreditCard },
  { label: "Rate limits", href: "/docs/rate-limits", icon: Gauge },
];

const ADMIN: Destination[] = [
  { label: "Admin overview", href: "/admin", icon: Shield },
  { label: "Margin & pricing", href: "/admin/margin", icon: SlidersHorizontal },
  { label: "Gateway stats", href: "/admin/stats", icon: TrendingUp },
];

function Group({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <Command.Group heading={heading} className="cmd-group">
      {children}
    </Command.Group>
  );
}

export function CommandPalette() {
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  const role = session?.user?.role ?? 0;
  const signedIn = Boolean(session?.user);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const dashboard = useMemo<Destination[]>(
    () =>
      dashboardNavGroups.flatMap((group) =>
        group.items.map((item) => ({
          label: item.label,
          href: item.href,
          icon: NAV_ICONS[item.icon],
          keywords: `${group.title} ${item.href}`,
        })),
      ),
    [],
  );

  const go = (href: string) => {
    setOpen(false);
    // A hash target only scrolls on a real navigation, not a client push.
    if (href.includes("#")) window.location.assign(href);
    else router.push(href);
  };

  const doSignOut = async () => {
    setOpen(false);
    await signout().catch(() => {});
    window.location.href = "/";
  };

  const item = (destination: Destination) => {
    const I = destination.icon;
    return (
      <Command.Item
        key={destination.href}
        value={destination.label}
        keywords={[destination.href, destination.keywords ?? ""]}
        onSelect={() => go(destination.href)}
        className="cmd-item"
      >
        <I size={15} aria-hidden="true" />
        <span>{destination.label}</span>
      </Command.Item>
    );
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command menu"
      overlayClassName="cmd-overlay"
      contentClassName="cmd-panel"
    >
      <Command.Input className="cmd-input" placeholder="Search pages and actions…" />
      <Command.List className="cmd-list">
        <Command.Empty className="cmd-empty">Nothing matches that.</Command.Empty>

        {signedIn ? <Group heading="Dashboard">{dashboard.map(item)}</Group> : null}
        <Group heading="Docs">{DOCS.map(item)}</Group>
        <Group heading="Site">{SITE.map(item)}</Group>
        {role >= 100 ? <Group heading="Admin">{ADMIN.map(item)}</Group> : null}

        <Group heading="Account">
          {signedIn ? (
            <Command.Item value="Sign out" onSelect={() => void doSignOut()} className="cmd-item">
              <LogOut size={15} aria-hidden="true" />
              <span>Sign out</span>
            </Command.Item>
          ) : (
            <Command.Item
              value="Sign in"
              onSelect={() => {
                setOpen(false);
                openAuthModal("signin");
              }}
              className="cmd-item"
            >
              <LogIn size={15} aria-hidden="true" />
              <span>Sign in</span>
            </Command.Item>
          )}
        </Group>
      </Command.List>
    </Command.Dialog>
  );
}
