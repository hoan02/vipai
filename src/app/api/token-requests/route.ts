import { NextResponse } from "next/server";
import { getAccount } from "@/server/auth";
import { createTokenRequest } from "@/server/repositories";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Honeypot: real users never fill this hidden field.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const telegram = typeof body.telegram === "string" ? body.telegram.trim() : "";
  const useCase = typeof body.useCase === "string" ? body.useCase.trim() : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "invalid_email", message: "Enter a valid email address." },
      { status: 422 },
    );
  }

  let userId: string | null = null;
  try {
    const account = await getAccount();
    userId = account?.id ?? null;
  } catch {
    userId = null;
  }

  await createTokenRequest({
    email,
    telegram: telegram || null,
    useCase: useCase || null,
    userId,
  });

  return NextResponse.json({ ok: true });
}
