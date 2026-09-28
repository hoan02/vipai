import { createAuthClient } from "limen-auth/react";
import { credentialPasswordPlugin, oauthClientPlugin } from "limen-auth/plugins";

export type UserCustomFields = {
  first_name?: string | null;
  last_name?: string | null;
};

const plugins = [credentialPasswordPlugin(), oauthClientPlugin()] as const;

/** Social providers the backend has configured. */
export type SocialProvider = "google";

// The gateway is same-origin behind Caddy, so baseURL carries the public origin
// and basePath the /_aigiare prefix. Caddy strips the prefix before proxying, so
// the gateway sees plain /api/... and /auth/... paths.
//
// The prefix is read from NEXT_PUBLIC_API_URL_PATH rather than hardcoded so a
// future move to a dedicated auth host is a single env change, not a code edit.
const API_PATH = process.env.NEXT_PUBLIC_API_URL_PATH ?? "/_aigiare";

export const authClient = createAuthClient<typeof plugins, UserCustomFields>({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "https://aigiare.site",
  basePath: `${API_PATH}/auth`,
  plugins,
});

export const { useSession, signIn, signUp, signout, getSession } = authClient;
