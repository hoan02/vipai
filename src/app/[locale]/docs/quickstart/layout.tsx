import type { ReactNode } from "react";

/**
 * Shared chrome for the agent quick-start guides.
 *
 * The step rail, the callout slots and the closing panel are written once here,
 * so each remaining guide is content work rather than layout work.
 */
export default function QuickStartLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
