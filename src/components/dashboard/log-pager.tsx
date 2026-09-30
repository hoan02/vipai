"use client";

import { useTranslations } from "next-intl";

/**
 * The footer every logs table shares: the visible window, and the pager.
 *
 * Extracted while the three sections were being translated — the markup was
 * identical in each, so the labels had to be written three times.
 */
export function LogPager({
  first,
  last,
  total,
  page,
  pageCount,
  loading,
  onGoto,
}: {
  first: number;
  last: number;
  total: number;
  page: number;
  pageCount: number;
  loading: boolean;
  onGoto: (page: number) => void;
}) {
  const t = useTranslations("logs");

  return (
    <div className="dtable-foot">
      <span className="note">
        {first}–{last} / {total.toLocaleString()}
        {loading ? t("loadingMore") : ""}
      </span>
      <span className="dtable-pager">
        <button
          className="pg"
          type="button"
          aria-label={t("prevPage")}
          disabled={page === 0 || loading}
          onClick={() => onGoto(Math.max(0, page - 1))}
        >
          ‹
        </button>
        <span className="pg-n">
          {page + 1}/{pageCount}
        </span>
        <button
          className="pg"
          type="button"
          aria-label={t("nextPage")}
          disabled={page >= pageCount - 1 || loading}
          onClick={() => onGoto(page + 1)}
        >
          ›
        </button>
      </span>
    </div>
  );
}

/** The failure strip above a logs table, shown instead of rows. */
export function LogError({ message }: { message: string }) {
  return (
    <div className="panel" style={{ padding: 14, marginTop: 16, color: "var(--danger)" }} role="alert">
      {message}
    </div>
  );
}
