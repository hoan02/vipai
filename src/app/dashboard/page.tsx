import { requireAccount } from "@/server/auth";
import { getDashboardBilling } from "@/server/dashboard";
import { BillingView } from "@/components/dashboard/billing-view";

export const dynamic = "force-dynamic";

export default async function DashboardBillingPage() {
  const account = await requireAccount();
  const billing = await getDashboardBilling(account.id);
  return <BillingView billing={billing} />;
}
