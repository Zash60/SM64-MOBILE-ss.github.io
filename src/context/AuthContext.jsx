import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { hasSupabase, MODERATOR_USER_ID, supabase } from "../lib/supabase";

const AuthContext = createContext(null);

function toAppUser(authUser, profile) {
    if (!authUser) return null;
    return {
        id: authUser.id,
        email: authUser.email,
        displayName:
            profile?.username
            || authUser.user_metadata?.display_name
            || authUser.email?.split("@")[0]
            || "Player"
    };
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [isModerator, setIsModerator] = useState(false);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");

    const syncSession = useCallback(async (session) => {
        if (!hasSupabase || !supabase) {
            setReady(true);
            setUser(null);
            setProfile(null);
            setIsModerator(false);
            return;
        }

        const authUser = session?.user;
        if (!authUser) {
            setUser(null);
            setProfile(null);
            setIsModerator(false);
            setReady(true);
            return;
        }

        try {
            const forcedModerator = Boolean(MODERATOR_USER_ID && authUser.id === MODERATOR_USER_ID);
            const [profileRes, modRes] = await Promise.all([
                supabase
                    .from("profiles")
                    .select("id, username")
                    .eq("id", authUser.id)
                    .maybeSingle(),
                supabase
                    .from("moderators")
                    .select("user_id")
                    .eq("user_id", authUser.id)
                    .maybeSingle()
            ]);

            if (profileRes.error) {
                throw profileRes.error;
            }

            const ignoredModErrorCodes = new Set(["PGRST116", "PGRST204", "PGRST205", "42P01"]);
            if (modRes.error && !ignoredModErrorCodes.has(modRes.error.code || "")) {
                throw modRes.error;
            }

            let profileRow = profileRes.data;
            if (!profileRow) {
                const fallbackName = authUser.user_metadata?.display_name || authUser.email?.split("@")[0] || "Player";
                const upsertRes = await supabase
                    .from("profiles")
                    .upsert({ id: authUser.id, username: fallbackName }, { onConflict: "id" })
                    .select("id, username")
                    .single();

                if (upsertRes.error) {
                    throw upsertRes.error;
                }
                profileRow = upsertRes.data;
            }

            setProfile(profileRow);
            setUser(toAppUser(authUser, profileRow));
            setIsModerator(Boolean(modRes.data) || forcedModerator);
            setError("");
        } catch (syncError) {
            setError(syncError.message || "Failed to load auth context");
            setUser(toAppUser(authUser, null));
            setProfile(null);
            setIsModerator(false);
        } finally {
            setReady(true);
        }
    }, []);

    const refreshAuth = useCallback(async () => {
        if (!supabase) return;
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            setError(sessionError.message);
            setReady(true);
            return;
        }
        await syncSession(data.session);
    }, [syncSession]);

    useEffect(() => {
        if (!hasSupabase || !supabase) {
            setReady(true);
            return undefined;
        }

        let active = true;

        const bootstrap = async () => {
            const { data, error: sessionError } = await supabase.auth.getSession();
            if (!active) return;

            if (sessionError) {
                setError(sessionError.message || "Auth bootstrap failed");
                setReady(true);
                return;
            }

            await syncSession(data.session);
        };

        bootstrap();

        const {
            data: { subscription }
        } = supabase.auth.onAuthStateChange((_event, session) => {
            syncSession(session);
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, [syncSession]);

    const register = useCallback(async (username, email, password) => {
        if (!supabase) {
            throw new Error("Supabase is not configured.");
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: username
                }
            }
        });

        if (signUpError) {
            throw signUpError;
        }

        if (data.user && data.session) {
            const profileRes = await supabase
                .from("profiles")
                .upsert({ id: data.user.id, username }, { onConflict: "id" });

            if (profileRes.error) {
                throw profileRes.error;
            }
        }

        return data;
    }, []);

    const login = useCallback(async (email, password) => {
        if (!supabase) {
            throw new Error("Supabase is not configured.");
        }

        const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) {
            throw loginError;
        }

        return data;
    }, []);

    const logout = useCallback(async () => {
        if (!supabase) {
            throw new Error("Supabase is not configured.");
        }

        const { error: logoutError } = await supabase.auth.signOut();
        if (logoutError) {
            throw logoutError;
        }
    }, []);

    const value = useMemo(
        () => ({
            hasSupabase,
            ready,
            user,
            profile,
            isModerator,
            error,
            refreshAuth,
            register,
            login,
            logout
        }),
        [error, isModerator, login, logout, profile, ready, refreshAuth, register, user]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
}
