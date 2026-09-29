"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Small, purely visual preferences that outlive a tab.
 *
 * Everything here is a UI choice the server never needs to know about, so it
 * is persisted to localStorage through Zustand's `persist` middleware instead
 * of being written by hand. The keys were carried over from the previous
 * hand-rolled storage names so existing visitors keep their choices.
 *
 * `skipHydration` is deliberate: localStorage only exists in the browser, so
 * hydrating during the store's creation would make the client's first render
 * disagree with the server HTML and trip a hydration error. Components call
 * `usePrefsStore.persist.rehydrate()` after mount instead.
 */
type PrefsState = {
  /** When the launch banner was dismissed (epoch ms), or null if never. */
  launchBannerDismissedAt: number | null;
  /** The setup guide's expanded state, or null when the visitor never chose. */
  setupGuideExpanded: boolean | null;
  dismissLaunchBanner: (at: number) => void;
  setSetupGuideExpanded: (expanded: boolean) => void;
};

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      launchBannerDismissedAt: null,
      setupGuideExpanded: null,
      dismissLaunchBanner: (at) => set({ launchBannerDismissedAt: at }),
      setSetupGuideExpanded: (setupGuideExpanded) => set({ setupGuideExpanded }),
    }),
    {
      name: "vipai.prefs.v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        launchBannerDismissedAt: state.launchBannerDismissedAt,
        setupGuideExpanded: state.setupGuideExpanded,
      }),
    },
  ),
);
