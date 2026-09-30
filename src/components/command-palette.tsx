"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
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

/** A palette row. Site/docs/admin rows carry a `key` into the `palette`
 *  namespace; the dashboard rows still carry the `label` the sidebar itself
 *  renders, and migrate with that tree. */
type Destination = { href: string; icon: LucideIcon; keywords?: string; key?: string; label?: string };

const SITE: Destination[] = [
  { key: "destHome", href: "/", icon: Home },
  { key: "destPricing", href: "/#pricing", icon: Tag },
  { key: "destCodex", href: "/download", icon: Download },
  { key: "destDocs", href: "/docs", icon: FileText },
];

const DOCS: Destination[] = [
  { key: "destQuickstart", href: "/docs/quickstart/claude-code", icon: Rocket },
  { key: "destApi", href: "/docs/api-integration", icon: Plug },
  { key: "destModels", href: "/docs/models", icon: Boxes },
  { key: "destBilling", href: "/docs/billing", icon: CreditCard },
  { key: "destRateLimits", href: "/docs/rate-limits", icon: Gauge },
];

const ADMIN: Destination[] = [
  { key: "destAdminOverview", href: "/admin", icon: Shield },
  { key: "destAdminMargin", href: "/admin/margin", icon: SlidersHorizontal },
  { key: "destAdminStats", href: "/admin/stats", icon: TrendingUp },
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
  const t = useTranslations("palette");
  const td = useTranslations("dash");
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
          label: td(item.labelKey),
          href: item.href,
          icon: NAV_ICONS[item.icon],
          keywords: `${td(group.titleKey)} ${item.href}`,
        })),
      ),
    [td],
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
    const label = destination.key ? t(destination.key) : (destination.label ?? "");
    return (
      <Command.Item
        key={destination.href}
        value={label}
        keywords={[destination.href, destination.keywords ?? ""]}
        onSelect={() => go(destination.href)}
        className="cmd-item"
      >
        <I size={15} aria-hidden="true" />
        <span>{label}</span>
      </Command.Item>
    );
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label={t("label")}
      overlayClassName="cmd-overlay"
      contentClassName="cmd-panel"
    >
      <Command.Input className="cmd-input" placeholder={t("placeholder")} />
      <Command.List className="cmd-list">
        <Command.Empty className="cmd-empty">{t("empty")}</Command.Empty>

        {signedIn ? <Group heading={t("groupDashboard")}>{dashboard.map(item)}</Group> : null}
        <Group heading={t("groupDocs")}>{DOCS.map(item)}</Group>
        <Group heading={t("groupSite")}>{SITE.map(item)}</Group>
        {role >= 100 ? <Group heading={t("groupAdmin")}>{ADMIN.map(item)}</Group> : null}

        <Group heading={t("groupAccount")}>
          {signedIn ? (
            <Command.Item value={t("signOut")} onSelect={() => void doSignOut()} className="cmd-item">
              <LogOut size={15} aria-hidden="true" />
              <span>{t("signOut")}</span>
            </Command.Item>
          ) : (
            <Command.Item
              value={t("signIn")}
              onSelect={() => {
                setOpen(false);
                openAuthModal("signin");
              }}
              className="cmd-item"
            >
              <LogIn size={15} aria-hidden="true" />
              <span>{t("signIn")}</span>
            </Command.Item>
          )}
        </Group>
      </Command.List>
    </Command.Dialog>
  );
}
