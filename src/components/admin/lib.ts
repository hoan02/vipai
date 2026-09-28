"use client";

export type SendResult<T = unknown> = { message?: string; data?: T };

/** One JSON request, normalised to `{ message }` on failure or `{ data }` on success. */
export async function send<T = unknown>(
  path: string,
  method: string,
  body: unknown,
): Promise<SendResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { message: "Could not reach the server." };
  }

  const payload = (await response.json().catch(() => null)) as { message?: string } | null;

  if (!response.ok) {
    return { message: payload?.message || `Request failed (HTTP ${response.status}).` };
  }
  return { data: (payload ?? undefined) as T };
}
