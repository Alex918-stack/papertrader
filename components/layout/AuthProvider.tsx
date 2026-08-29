"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  status: "loading",
});

// Mirrors the shape next-auth's useSession() had (a "status" string plus
// the signed-in user), so every place that used to check
// status === "authenticated" keeps working with a one-line import swap.
export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    const supabase = createClient();

    // Resolve the current session once on mount...
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setStatus(session?.user ? "authenticated" : "unauthenticated");
    });

    // ...then stay in sync with sign-in, sign-out, and token refresh events
    // for as long as this component is mounted (i.e. for the whole app).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setStatus(session?.user ? "authenticated" : "unauthenticated");
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, status }}>
      {children}
    </AuthContext.Provider>
  );
}
