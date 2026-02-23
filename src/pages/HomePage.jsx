import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { hasSupabase, supabase } from "../lib/supabase";
import {
    formatDate,
    formatTime,
    mapHackRow,
    mapRunRow,
    safeUrl,
    unwrap
} from "../lib/utils";

const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Crect width='100%25' height='100%25' fill='%23222'/%3E%3Ctext x='50%25' y='50%25' fill='%23ffffff' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='36'%3ESM64%3C/text%3E%3C/svg%3E";

function sortHacks(hacks, runs, sortBy) {
    const runCounts = runs.reduce((acc, run) => {
        acc[run.hack_id] = (acc[run.hack_id] || 0) + 1;
        return acc;
    }, {});

    const sorted = [...hacks];

    if (sortBy === "most_runs") {
        sorted.sort((a, b) => (runCounts[b.id] || 0) - (runCounts[a.id] || 0));
    } else if (sortBy === "least_runs") {
        sorted.sort((a, b) => (runCounts[a.id] || 0) - (runCounts[b.id] || 0));
    } else {
        sorted.sort((a, b) => {
            const nameA = a.name.toLowerCase().startsWith("the ") ? a.name.substring(4) : a.name;
            const nameB = b.name.toLowerCase().startsWith("the ") ? b.name.substring(4) : b.name;
            return nameA.localeCompare(nameB);
        });
    }

    return { sorted, runCounts };
}

export default function HomePage() {
    const { hasSupabase: authHasSupabase } = useAuth();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [hacks, setHacks] = useState([]);
    const [runs, setRuns] = useState([]);

    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState("name_asc");

    useEffect(() => {
        const loadData = async () => {
            if (!hasSupabase || !supabase || !authHasSupabase) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError("");

                const [hacksRes, runsRes] = await Promise.all([
                    supabase.from("hacks").select("*").order("name", { ascending: true }),
                    supabase.from("runs").select("*").eq("status", "approved")
                ]);

                const hackRows = unwrap(hacksRes, "Failed to load hacks");
                const runRows = unwrap(runsRes, "Failed to load runs");

                setHacks((hackRows || []).map(mapHackRow));
                setRuns((runRows || []).map(mapRunRow));
            } catch (loadError) {
                setError(loadError.message || "Could not load dashboard.");
                showToast(loadError.message || "Could not load dashboard.", "error", 5000);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [authHasSupabase, showToast]);

    const { sorted, runCounts } = useMemo(() => sortHacks(hacks, runs, sortBy), [hacks, runs, sortBy]);

    const filteredHacks = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return sorted;
        return sorted.filter((hack) => hack.name.toLowerCase().includes(term));
    }, [searchTerm, sorted]);

    const recentRuns = useMemo(
        () => [...runs]
            .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())
            .slice(0, 8),
        [runs]
    );

    if (!authHasSupabase) {
        return (
            <section className="card">
                <h2>Supabase setup required</h2>
                <p>
                    Configure <code>config.js</code> or environment variables before using the app.
                </p>
            </section>
        );
    }

    return (
        <section className="page-home">
            <div className="card">
                <h2>Recent Activity</h2>
                {loading && <p>Loading activity...</p>}
                {!loading && recentRuns.length === 0 && <p>No approved runs yet.</p>}
                {!loading && recentRuns.length > 0 && (
                    <div className="activity-list">
                        {recentRuns.map((run) => (
                            <div key={run.id} className="activity-item">
                                <strong>{run.playerName}</strong> set {formatTime(run.timeInMs)} on {run.hackName}
                                <span>{formatDate(run.dateAchieved)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="card">
                <div className="section-head">
                    <h2>All Games</h2>
                    <div className="section-head-actions">
                        <label>
                            Search
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Search hacks"
                            />
                        </label>

                        <label>
                            Sort by
                            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                                <option value="name_asc">Name</option>
                                <option value="most_runs">Most runs</option>
                                <option value="least_runs">Least runs</option>
                            </select>
                        </label>
                    </div>
                </div>

                {loading && <p>Loading hacks...</p>}
                {error && <p className="error-text">{error}</p>}

                {!loading && filteredHacks.length === 0 && <p>No hacks found.</p>}

                {!loading && filteredHacks.length > 0 && (
                    <div className="game-grid">
                        {filteredHacks.map((hack) => (
                            <Link key={hack.id} to={`/hack/${encodeURIComponent(hack.slug)}`} className="game-card">
                                <img src={safeUrl(hack.imageUrl) || PLACEHOLDER_IMAGE} alt={hack.name} loading="lazy" />
                                <div className="game-overlay">
                                    <h3>{hack.name}</h3>
                                    <p>{hack.year || "Unknown year"}</p>
                                    <span>{runCounts[hack.id] || 0} runs</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
