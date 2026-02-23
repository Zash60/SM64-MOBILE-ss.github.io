import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { hasSupabase, supabase } from "../lib/supabase";
import {
    formatDate,
    formatTime,
    generateCompareKeyWithoutUser,
    mapRunRow,
    unwrap
} from "../lib/utils";

export default function ProfilePage() {
    const { ready, user } = useAuth();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [runs, setRuns] = useState([]);
    const [worldRecords, setWorldRecords] = useState(0);

    useEffect(() => {
        const loadProfileRuns = async () => {
            if (!ready) return;

            if (!user) {
                setRuns([]);
                setWorldRecords(0);
                setLoading(false);
                return;
            }

            if (!hasSupabase || !supabase) {
                setError("Supabase is not configured.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError("");

                const runsRes = await supabase
                    .from("runs")
                    .select("*")
                    .eq("user_id", user.id)
                    .order("submitted_at", { ascending: false });

                const runRows = unwrap(runsRes, "Failed to load profile runs") || [];
                const mappedRuns = runRows.map(mapRunRow);
                setRuns(mappedRuns);

                const approvedRuns = mappedRuns.filter((run) => run.status === "approved");
                if (approvedRuns.length === 0) {
                    setWorldRecords(0);
                    return;
                }

                const categoryIds = Array.from(new Set(approvedRuns.map((run) => run.category_id)));

                const categoryQueries = await Promise.all(
                    categoryIds.map((categoryId) =>
                        supabase
                            .from("runs")
                            .select("*")
                            .eq("category_id", categoryId)
                            .eq("status", "approved")
                    )
                );

                const categoryRunsMap = new Map();
                categoryQueries.forEach((res, index) => {
                    const rows = unwrap(res, "Failed to compute world record stats") || [];
                    categoryRunsMap.set(categoryIds[index], rows.map(mapRunRow));
                });

                let wrCount = 0;

                approvedRuns.forEach((run) => {
                    const compareKey = generateCompareKeyWithoutUser(run);
                    const categoryRuns = categoryRunsMap.get(run.category_id) || [];
                    const relevantRuns = categoryRuns
                        .filter((candidate) => generateCompareKeyWithoutUser(candidate) === compareKey)
                        .sort((a, b) => a.timeInMs - b.timeInMs);

                    if (relevantRuns[0]?.id === run.id) {
                        wrCount += 1;
                    }
                });

                setWorldRecords(wrCount);
            } catch (loadError) {
                setError(loadError.message || "Could not load profile.");
                showToast(loadError.message || "Could not load profile.", "error", 5000);
            } finally {
                setLoading(false);
            }
        };

        loadProfileRuns();
    }, [ready, showToast, user]);

    const approvedRuns = useMemo(() => runs.filter((run) => run.status === "approved"), [runs]);
    const pendingRuns = useMemo(() => runs.filter((run) => run.status === "pending"), [runs]);
    const obsoleteRuns = useMemo(() => runs.filter((run) => run.status === "obsolete"), [runs]);

    if (!ready) {
        return (
            <section className="card">
                <p>Loading profile...</p>
            </section>
        );
    }

    if (!user) {
        return (
            <section className="card">
                <h2>Profile</h2>
                <p>You need to login to view your profile.</p>
                <p><Link to="/">Back to Home</Link></p>
            </section>
        );
    }

    return (
        <section className="page-profile">
            <div className="stats-grid">
                <article className="stat-card">
                    <h4>Total PBs</h4>
                    <strong>{approvedRuns.length}</strong>
                </article>
                <article className="stat-card">
                    <h4>World Records</h4>
                    <strong>{worldRecords}</strong>
                </article>
                <article className="stat-card">
                    <h4>Pending</h4>
                    <strong>{pendingRuns.length}</strong>
                </article>
            </div>

            {error && <p className="error-text">{error}</p>}
            {loading && <p>Loading runs...</p>}

            {!loading && (
                <>
                    <div className="card">
                        <h3>Personal Bests</h3>
                        {approvedRuns.length === 0 && <p>No approved runs yet.</p>}
                        {approvedRuns.length > 0 && (
                            <div className="run-list">
                                {approvedRuns.map((run) => (
                                    <div key={run.id} className="run-item">
                                        <div>
                                            <strong>{run.hackName}</strong>
                                            <span>{run.categoryName}</span>
                                        </div>
                                        <div>{formatTime(run.timeInMs)}</div>
                                        <div>{formatDate(run.dateAchieved)}</div>
                                        <a href={run.videoUrl} target="_blank" rel="noreferrer">Video</a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="card">
                        <h3>Obsolete Runs</h3>
                        {obsoleteRuns.length === 0 && <p>No obsolete runs.</p>}
                        {obsoleteRuns.length > 0 && (
                            <div className="run-list">
                                {obsoleteRuns.map((run) => (
                                    <div key={run.id} className="run-item">
                                        <div>
                                            <strong>{run.hackName}</strong>
                                            <span>{run.categoryName}</span>
                                        </div>
                                        <div>{formatTime(run.timeInMs)}</div>
                                        <div>{formatDate(run.dateAchieved)}</div>
                                        <a href={run.videoUrl} target="_blank" rel="noreferrer">Video</a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
