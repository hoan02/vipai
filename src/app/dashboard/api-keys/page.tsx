import { getUserModels, listGroups } from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";
import { getDashboardKeys } from "@/server/dashboard";
import { ApiKeysView } from "@/components/dashboard/api-keys-view";

export const dynamic = "force-dynamic";

export default async function DashboardApiKeysPage() {
  const token = await requireAccessToken();

  // The key list is essential; the two pickers are conveniences, so a failure in
  // either degrades to an empty option set rather than failing the page.
  const [keys, groups, models] = await Promise.all([
    getDashboardKeys(),
    listGroups(token)
      .then((rows) => rows.map((row) => row.name))
      .catch(() => [] as string[]),
    getUserModels(token).catch(() => [] as string[]),
  ]);

  return <ApiKeysView initialKeys={keys} groups={groups} models={models} />;
}
