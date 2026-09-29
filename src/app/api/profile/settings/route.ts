import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import { updateNotificationSettings, type NotificationSettings } from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";

export const dynamic = "force-dynamic";

const NOTIFY_TYPES = ["email", "webhook", "bark", "gotify"];

/**
 * Saves the notification and privacy preferences.
 *
 * The gateway rebuilds the whole setting blob from these fields, so the route
 * validates them here rather than letting a bad value wipe the stored settings.
 */
export async function PUT(request: Request) {
  let token: string;
  try {
    await requireAccount();
    token = await requireAccessToken();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const str = (key: string) => (typeof body[key] === "string" ? (body[key] as string).trim() : "");
  const num = (key: string, fallback: number) => {
    const value = Number(body[key]);
    return Number.isFinite(value) ? value : fallback;
  };
  const bool = (key: string) => body[key] === true;

  const notifyType = str("notifyType") || "email";
  if (!NOTIFY_TYPES.includes(notifyType)) {
    return NextResponse.json(
      { error: "invalid_type", message: "Choose a notification method." },
      { status: 422 },
    );
  }

  const threshold = num("quotaWarningThreshold", 0);
  if (threshold <= 0) {
    return NextResponse.json(
      { error: "invalid_threshold", message: "The warning threshold must be above zero." },
      { status: 422 },
    );
  }

  const settings: NotificationSettings = {
    notifyType,
    quotaWarningThreshold: threshold,
    notificationEmail: str("notificationEmail"),
    webhookUrl: str("webhookUrl"),
    webhookSecret: str("webhookSecret"),
    barkUrl: str("barkUrl"),
    gotifyUrl: str("gotifyUrl"),
    gotifyToken: str("gotifyToken"),
    gotifyPriority: num("gotifyPriority", 5),
    acceptUnsetModelRatioModel: bool("acceptUnsetModelRatioModel"),
    recordIpLog: bool("recordIpLog"),
    upstreamModelUpdateNotifyEnabled: bool("upstreamModelUpdateNotifyEnabled"),
  };

  if (notifyType === "webhook" && !settings.webhookUrl) {
    return NextResponse.json(
      { error: "missing_webhook", message: "Enter a webhook URL." },
      { status: 422 },
    );
  }
  if (notifyType === "bark" && !settings.barkUrl) {
    return NextResponse.json(
      { error: "missing_bark", message: "Enter a Bark push URL." },
      { status: 422 },
    );
  }
  if (notifyType === "gotify" && (!settings.gotifyUrl || !settings.gotifyToken)) {
    return NextResponse.json(
      { error: "missing_gotify", message: "Enter the Gotify URL and token." },
      { status: 422 },
    );
  }

  try {
    await updateNotificationSettings(token, settings);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = (error as Error).message;
    const status = /setting|threshold|url|email|token/i.test(message) ? 422 : 502;
    return NextResponse.json({ error: "settings_failed", message }, { status });
  }
}
