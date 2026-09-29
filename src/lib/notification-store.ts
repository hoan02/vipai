"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Which console announcements this visitor has already opened.
 *
 * The gateway's status payload carries no per-account read state, so "read" is
 * a browser-local fact and lives here rather than on the server. Announcements
 * are not guaranteed an id, so the key is the id when present and a content
 * fingerprint otherwise; a small edit to an announcement therefore reads as a
 * new one, which is the safe direction to be wrong in.
 *
 * Screens must call `useNotificationStore.persist.rehydrate()` after mount:
 * `skipHydration` keeps the server render and the first client render equal.
 */
type NotificationState = {
  /** Keys of announcements already opened, in no particular order. */
  readAnnouncementKeys: string[];
  markAnnouncementsRead: (keys: string[]) => void;
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      readAnnouncementKeys: [],
      markAnnouncementsRead: (keys) =>
        set((state) => ({
          readAnnouncementKeys: [...new Set([...state.readAnnouncementKeys, ...keys])],
        })),
    }),
    {
      name: "vipai.notifications.v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ readAnnouncementKeys: state.readAnnouncementKeys }),
    },
  ),
);
