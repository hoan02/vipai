import { requireAccount } from "@/server/auth";
import { getUserModels } from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";
import { PlaygroundView } from "@/components/dashboard/playground-view";

export const dynamic = "force-dynamic";

/** Models that make a good first pick, if the account is allowed them. */
const PREFERRED = ["claude-haiku-4-5", "gpt-5-mini", "gemini-2.5-flash"];

export default async function PlaygroundPage() {
  await requireAccount();
  const token = await requireAccessToken();
  const models = await getUserModels(token).catch(() => [] as string[]);

  const defaultModel = PREFERRED.find((m) => models.includes(m)) ?? models[0] ?? "";

  return <PlaygroundView models={models} defaultModel={defaultModel} />;
}
