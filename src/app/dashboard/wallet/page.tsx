import {
  getLogStat,
  getSubscriptionPlans,
  getSubscriptionSelf,
  getTopUpInfo,
  getUser,
  listTopUps,
  QUOTA_PER_USD,
} from "@/server/gateway";
import { requireAccessToken } from "@/server/repositories";
import { WalletView, type WalletInfo, type WalletTopUp } from "@/components/dashboard/wallet-view";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const token = await requireAccessToken();
  const [user, topups, info, stat, plans, subscription] = await Promise.all([
    getUser(token),
    listTopUps(token),
    getTopUpInfo(token),
    getLogStat(token),
    getSubscriptionPlans(token).catch(() => []),
    getSubscriptionSelf(token).catch(() => ({ billingPreference: "balance", active: [], all: [] })),
  ]);

  const rows: WalletTopUp[] = topups.map((row) => ({
    id: row.id,
    amountUsd: (row.amount ?? 0) / QUOTA_PER_USD,
    paidUsd: row.money ?? 0,
    tradeNo: row.trade_no || "",
    status: row.status || "",
    paymentMethod: row.payment_method || "",
    createdAt: new Date((row.create_time ?? 0) * 1000).toISOString(),
    completedAt: row.complete_time ? new Date(row.complete_time * 1000).toISOString() : null,
  }));

  const walletInfo: WalletInfo = info;

  return (
    <WalletView
      balanceUsd={user.quota / QUOTA_PER_USD}
      usedUsd={user.usedQuota / QUOTA_PER_USD}
      requestCount={user.requestCount}
      info={walletInfo}
      topups={rows}
      plans={plans}
      subscription={subscription}
      affiliate={{
        code: user.affCode,
        count: user.affCount,
        earnedUsd: user.affQuota / QUOTA_PER_USD,
        quota: user.affQuota,
      }}
    />
  );
}
