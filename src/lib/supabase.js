import { createClient } from "@supabase/supabase-js";

const urlFromWindow = typeof window !== "undefined" ? window.SUPABASE_URL : "";
const keyFromWindow = typeof window !== "undefined" ? window.SUPABASE_ANON_KEY : "";
const moderatorIdFromWindow = typeof window !== "undefined" ? window.MODERATOR_USER_ID : "";

const SUPABASE_URL = urlFromWindow || import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = keyFromWindow || import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const MODERATOR_USER_ID = moderatorIdFromWindow || import.meta.env.VITE_MODERATOR_USER_ID || "";

export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

async function noOpLock(_name, _acquireTimeout, fn) {
    return fn();
}

export const supabase = hasSupabase
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            lock: noOpLock
        }
    })
    : null;
