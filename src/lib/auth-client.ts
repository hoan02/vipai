import { createAuthClient } from "limen-auth/react";
import { credentialPasswordPlugin } from "limen-auth/plugins";

export type UserCustomFields = {
  firstname?: string | null;
  lastname?: string | null;
};

const plugins = [credentialPasswordPlugin()] as const;

export const authClient = createAuthClient<typeof plugins, UserCustomFields>({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
  basePath: "/auth",
  plugins,
});

export const { useSession, signIn, signUp, signout, getSession } = authClient;
