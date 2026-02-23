import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from "react-router-dom";

import AuthModal from "./components/AuthModal";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider, useToast } from "./context/ToastContext";
import HackPage from "./pages/HackPage";
import HomePage from "./pages/HomePage";
import ModeratorPage from "./pages/ModeratorPage";
import ProfilePage from "./pages/ProfilePage";

function AppShell({ onOpenAuth }) {
    const { hasSupabase, ready, user, profile, isModerator, logout, error } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    const handleLogout = async () => {
        try {
            await logout();
            showToast("Logged out.", "info");
            navigate("/");
        } catch (logoutError) {
            showToast(logoutError.message || "Could not logout.", "error");
        }
    };

    return (
        <div className="app-shell">
            <header className="site-header">
                <div className="container topbar">
                    <h1>SM64 Hack Roms Speedrun Mobile</h1>

                    <nav className="topnav">
                        <button
                            type="button"
                            className="icon-button"
                            title="Toggle theme"
                            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                        >
                            {theme === "dark" ? "moon" : "sun"}
                        </button>

                        <NavLink to="/">Home</NavLink>

                        {ready && user && <NavLink to="/profile">Profile</NavLink>}
                        {ready && user && isModerator && <NavLink to="/moderator">Moderator</NavLink>}

                        {ready && user && (
                            <button type="button" className="link-button" onClick={handleLogout}>
                                Logout
                            </button>
                        )}

                        {ready && !user && (
                            <>
                                <button type="button" className="link-button" onClick={() => onOpenAuth("register")}>
                                    Register
                                </button>
                                <button type="button" className="link-button" onClick={() => onOpenAuth("login")}>
                                    Login
                                </button>
                            </>
                        )}
                    </nav>
                </div>
            </header>

            {!hasSupabase && (
                <section className="container setup-warning">
                    <strong>Supabase setup required.</strong>
                    <p>
                        Create <code>public/config.js</code> from <code>public/config.example.js</code> or use
                        <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
                    </p>
                </section>
            )}

            {error && (
                <section className="container setup-warning error">
                    <strong>Auth warning:</strong> {error}
                </section>
            )}

            <main className="container page-wrap">
                <Outlet />
            </main>

            <footer className="site-footer">
                <div className="container">
                    <p>SM64 Hack Roms Speedrun Mobile</p>
                    <p>
                        Powered by <a href="https://supabase.com" target="_blank" rel="noreferrer">Supabase</a>
                        {" "}and data synced with <a href="https://speedrun.com" target="_blank" rel="noreferrer">speedrun.com</a>
                    </p>
                    {!ready && <p>Loading session...</p>}
                    {ready && user && <p>Signed in as {profile?.username || user.displayName}</p>}
                </div>
            </footer>
        </div>
    );
}

function RoutedApp() {
    const [authMode, setAuthMode] = useState(null);

    return (
        <>
            <Routes>
                <Route element={<AppShell onOpenAuth={setAuthMode} />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/hack/:slug" element={<HackPage onOpenAuth={() => setAuthMode("login")} />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/moderator" element={<ModeratorPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>

            <AuthModal mode={authMode} open={Boolean(authMode)} onClose={() => setAuthMode(null)} />
        </>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <ToastProvider>
                <RoutedApp />
            </ToastProvider>
        </AuthProvider>
    );
}
