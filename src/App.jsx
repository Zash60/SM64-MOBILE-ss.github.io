import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from "react-router-dom";

import AuthModal from "./components/AuthModal";
import SubmitRunModal from "./components/SubmitRunModal";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider, useToast } from "./context/ToastContext";
import { buildRunPayload, loadMobileSetup } from "./lib/mobileRecords";
import { hasSupabase, supabase } from "./lib/supabase";
import CoursesPage from "./pages/CoursesPage";
import ModeratorPage from "./pages/ModeratorPage";
import ProfilePage from "./pages/ProfilePage";
import StarPage from "./pages/StarPage";
import TimelinePage from "./pages/TimelinePage";

function AppShell({ onOpenAuth, onOpenSubmit }) {
    const { ready, user, profile, isModerator, logout, error } = useAuth();
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
            <header>
                <h1>SM64 Mobile - Records</h1>

                <nav>
                    <NavLink to="/" end className="nav-link">Courses</NavLink>
                    <NavLink to="/timeline" className="nav-link">Timeline</NavLink>
                    {ready && user && <NavLink to="/profile" className="nav-link">Profile</NavLink>}
                    {ready && user && isModerator && <NavLink to="/moderator" className="nav-link">Mod Queue</NavLink>}

                    <span className="pipe">|</span>

                    <button type="button" className="action-button" onClick={onOpenSubmit}>
                        Submit Run
                    </button>

                    {ready && user && (
                        <button type="button" className="login-btn" onClick={handleLogout}>Logout</button>
                    )}

                    {ready && !user && (
                        <>
                            <button type="button" className="login-btn" onClick={() => onOpenAuth("register")}>Register</button>
                            <button type="button" className="login-btn" onClick={() => onOpenAuth("login")}>Login</button>
                        </>
                    )}

                    <button
                        type="button"
                        className="theme-btn"
                        onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                    >
                        {theme === "dark" ? "Light" : "Dark"}
                    </button>
                </nav>
            </header>

            {!hasSupabase && (
                <section className="setup-warning">
                    <strong>Supabase setup required.</strong>
                    <p>
                        Configure <code>config.js</code> with <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code>.
                    </p>
                </section>
            )}

            {error && (
                <section className="setup-warning error">
                    <strong>Auth warning:</strong> {error}
                </section>
            )}

            <main>
                <Outlet />
            </main>

            <footer>
                <p>SM64 Mobile Records</p>
                <p>
                    Powered by <a href="https://supabase.com" target="_blank" rel="noreferrer">Supabase</a>
                    {" "}and data synced by moderators.
                </p>
                {!ready && <p>Loading session...</p>}
                {ready && user && <p>Signed in as {profile?.username || user.displayName}</p>}
            </footer>
        </div>
    );
}

function RoutedApp() {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [authMode, setAuthMode] = useState(null);
    const [submitOpen, setSubmitOpen] = useState(false);
    const [submittingRun, setSubmittingRun] = useState(false);

    const submitRun = async (form) => {
        if (!hasSupabase || !supabase) {
            throw new Error("Supabase is not configured.");
        }

        setSubmittingRun(true);

        try {
            const setup = await loadMobileSetup();
            if (!setup.hack || !setup.category) {
                throw new Error("Site setup missing. Ask moderator to initialize Mod Queue first.");
            }

            const payload = buildRunPayload({
                setup,
                playerName: form.playerName,
                courseId: form.courseId,
                starIndex: form.starIndex,
                igt: form.igt,
                rta: form.rta,
                dateAchieved: form.dateAchieved,
                videoUrl: form.videoUrl,
                userId: user?.id || "anonymous",
                approveNow: false
            });

            const insertRes = await supabase
                .from("runs")
                .insert(payload);

            if (insertRes.error) {
                throw insertRes.error;
            }

            showToast("Run submitted for moderation.", "success");
        } finally {
            setSubmittingRun(false);
        }
    };

    return (
        <>
            <Routes>
                <Route element={<AppShell onOpenAuth={setAuthMode} onOpenSubmit={() => setSubmitOpen(true)} />}>
                    <Route path="/" element={<CoursesPage />} />
                    <Route path="/timeline" element={<TimelinePage />} />
                    <Route path="/star/:courseId/:starIndex" element={<StarPage />} />
                    <Route path="/moderator" element={<ModeratorPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>

            <AuthModal mode={authMode} open={Boolean(authMode)} onClose={() => setAuthMode(null)} />

            <SubmitRunModal
                open={submitOpen}
                onClose={() => setSubmitOpen(false)}
                onSubmit={submitRun}
                submitting={submittingRun}
            />
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
