import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import EditRunModal from "../components/EditRunModal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
    MOBILE_HACK_SLUG,
    bootstrapMobileSetup,
    buildRunPayload,
    getRunCourseId,
    getRunIgt,
    getRunRta,
    getRunStarIndex,
    getRunStarName,
    loadMobileSetup
} from "../lib/mobileRecords";
import { hasSupabase, supabase } from "../lib/supabase";
import { formatDate, mapRunRow, unwrap } from "../lib/utils";

function sortByNewest(runs) {
    return [...runs].sort(
        (left, right) => new Date(right.submittedAt || right.dateAchieved || 0).getTime()
            - new Date(left.submittedAt || left.dateAchieved || 0).getTime()
    );
}

export default function ModeratorPage() {
    const { ready, user, isModerator } = useAuth();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [setup, setSetup] = useState({ hack: null, category: null });
    const [runs, setRuns] = useState([]);

    const [working, setWorking] = useState(false);
    const [selectedRun, setSelectedRun] = useState(null);

    const loadData = async () => {
        if (!hasSupabase || !supabase) {
            setError("Supabase is not configured.");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError("");

            const setupData = await loadMobileSetup();
            setSetup({
                hack: setupData.hack,
                category: setupData.category
            });

            if (!setupData.hack) {
                setRuns([]);
                return;
            }

            const runsRes = await supabase
                .from("runs")
                .select("*")
                .eq("hack_slug", MOBILE_HACK_SLUG)
                .order("submitted_at", { ascending: false });

            const runRows = unwrap(runsRes, "Failed to load moderation queue") || [];
            setRuns(runRows.map(mapRunRow));
        } catch (loadError) {
            setError(loadError.message || "Could not load moderator queue.");
            showToast(loadError.message || "Could not load moderator queue.", "error", 5000);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!ready) return;
        if (!user || !isModerator) {
            setLoading(false);
            return;
        }
        loadData();
    }, [ready, user, isModerator]);

    const pendingRuns = useMemo(
        () => sortByNewest(runs.filter((run) => run.status === "pending")),
        [runs]
    );

    const approvedRuns = useMemo(
        () => sortByNewest(runs.filter((run) => run.status === "approved")).slice(0, 40),
        [runs]
    );

    const initializeSite = async () => {
        try {
            setWorking(true);
            await bootstrapMobileSetup();
            showToast("Site structure initialized in Supabase.", "success");
            await loadData();
        } catch (bootstrapError) {
            showToast(bootstrapError.message || "Could not initialize site.", "error", 5000);
        } finally {
            setWorking(false);
        }
    };

    const moderateRun = async (run, status) => {
        if (!supabase) return;

        try {
            setWorking(true);
            const updateRes = await supabase
                .from("runs")
                .update({ status })
                .eq("id", run.id);

            if (updateRes.error) {
                throw updateRes.error;
            }

            showToast(`Run set to ${status}.`, "success");
            await loadData();
        } catch (moderationError) {
            showToast(moderationError.message || "Could not update run.", "error", 5000);
        } finally {
            setWorking(false);
        }
    };

    const deleteRun = async (run) => {
        if (!supabase) return;
        const confirmed = window.confirm(`Delete run from ${run.playerName}?`);
        if (!confirmed) return;

        try {
            setWorking(true);
            const deleteRes = await supabase
                .from("runs")
                .delete()
                .eq("id", run.id);

            if (deleteRes.error) {
                throw deleteRes.error;
            }

            showToast("Run deleted.", "info");
            await loadData();
        } catch (deleteError) {
            showToast(deleteError.message || "Could not delete run.", "error", 5000);
        } finally {
            setWorking(false);
        }
    };

    const saveEditedRun = async (run, form) => {
        if (!supabase || !setup.hack || !setup.category) {
            throw new Error("Site setup is missing.");
        }

        const payload = buildRunPayload({
            setup,
            playerName: form.playerName,
            courseId: form.courseId,
            starIndex: form.starIndex,
            igt: form.igt,
            rta: form.rta,
            version: form.version,
            dateAchieved: form.dateAchieved,
            videoUrl: form.videoUrl,
            userId: run.userId,
            approveNow: run.status === "approved"
        });

        payload.status = run.status;

        const updateRes = await supabase
            .from("runs")
            .update(payload)
            .eq("id", run.id);

        if (updateRes.error) {
            throw updateRes.error;
        }

        showToast("Run updated.", "success");
        await loadData();
    };

    if (!ready) {
        return <section className="course-section"><div className="course-body">Loading moderator panel...</div></section>;
    }

    if (!user || !isModerator) {
        return (
            <section className="course-section">
                <div className="course-header bg-secret">Access denied</div>
                <div className="course-body">
                    You must be logged in as moderator.
                    <p><Link to="/">Back to Courses</Link></p>
                </div>
            </section>
        );
    }

    return (
        <section>
            <article className="course-section">
                <div className="course-header bg-secret">Site Setup</div>
                <div className="course-body">
                    {setup.hack && setup.category
                        ? `Configured: ${setup.hack.name} / ${setup.category.name}`
                        : "This site is not initialized in Supabase yet."}

                    <div className="stack-actions">
                        <button type="button" className="btn" onClick={initializeSite} disabled={working}>
                            {working ? "Working..." : setup.hack ? "Rebuild Course Structure" : "Initialize Site"}
                        </button>
                    </div>
                </div>
            </article>

            <article className="course-section">
                <div className="course-header bg-bowser">Pending Verification</div>
                <div className="course-body">
                    {loading && <p className="status-line">Loading queue...</p>}
                    {error && <p className="error-text">{error}</p>}
                    {!loading && pendingRuns.length === 0 && <p className="status-line">No pending runs.</p>}

                    {!loading && pendingRuns.length > 0 && (
                        <div className="mod-list">
                            {pendingRuns.map((run) => (
                                <div className="mod-card" key={run.id}>
                                    <div>
                                        <h4>{getRunCourseId(run).toUpperCase()} - {getRunStarName(run)}</h4>
                                        <p>
                                            <strong>{run.playerName}</strong> | IGT: {getRunIgt(run)} | RT: {getRunRta(run)}
                                        </p>
                                        <p>{formatDate(run.dateAchieved)}</p>
                                        {run.videoUrl && (
                                            <p><a href={run.videoUrl} target="_blank" rel="noreferrer">Open Video</a></p>
                                        )}
                                    </div>

                                    <div className="mod-queue-controls">
                                        <button type="button" className="btn btn-edit" onClick={() => setSelectedRun(run)}>
                                            Edit
                                        </button>
                                        <button type="button" className="btn btn-approve" onClick={() => moderateRun(run, "approved")}>
                                            Approve
                                        </button>
                                        <button type="button" className="btn btn-reject" onClick={() => moderateRun(run, "rejected")}>
                                            Reject
                                        </button>
                                        <button type="button" className="btn btn-delete" onClick={() => deleteRun(run)}>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </article>

            <article className="course-section">
                <div className="course-header bg-wdw">Recent Approved Runs</div>
                <div className="table-responsive">
                    <table className="records-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Player</th>
                                <th>Course</th>
                                <th>Star</th>
                                <th>RT</th>
                                <th>IGT</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {approvedRuns.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="empty-run">No approved runs.</td>
                                </tr>
                            )}
                            {approvedRuns.map((run) => (
                                <tr key={run.id}>
                                    <td>{formatDate(run.dateAchieved)}</td>
                                    <td>{run.playerName}</td>
                                    <td>{getRunCourseId(run).toUpperCase()}</td>
                                    <td>{getRunStarName(run)}</td>
                                    <td>{getRunRta(run)}</td>
                                    <td>{getRunIgt(run)}</td>
                                    <td>
                                        <div className="table-actions">
                                            <button type="button" className="btn btn-edit" onClick={() => setSelectedRun(run)}>
                                                Edit
                                            </button>
                                            <button type="button" className="btn btn-delete" onClick={() => deleteRun(run)}>
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </article>

            <EditRunModal
                open={Boolean(selectedRun)}
                run={selectedRun}
                onClose={() => setSelectedRun(null)}
                onSubmit={saveEditedRun}
                saving={working}
            />
        </section>
    );
}
