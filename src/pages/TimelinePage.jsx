import { useEffect, useMemo, useState } from "react";

import { getCourseById } from "../data/courses";
import {
    MOBILE_HACK_SLUG,
    getRunCourseId,
    getRunDateTimestamp,
    getRunIgt,
    getRunStarName,
    getTimelineTag,
    getVideoEmbedUrl,
    loadMobileSetup
} from "../lib/mobileRecords";
import { hasSupabase, supabase } from "../lib/supabase";
import { formatDate, mapRunRow, unwrap } from "../lib/utils";

export default function TimelinePage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [setupReady, setSetupReady] = useState(false);
    const [runs, setRuns] = useState([]);
    const [openVideoRunId, setOpenVideoRunId] = useState("");

    useEffect(() => {
        const loadData = async () => {
            if (!hasSupabase || !supabase) {
                setError("Supabase is not configured.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError("");

                const setup = await loadMobileSetup();
                setSetupReady(Boolean(setup.hack && setup.category));

                if (!setup.hack) {
                    setRuns([]);
                    return;
                }

                const runsRes = await supabase
                    .from("runs")
                    .select("*")
                    .eq("hack_slug", MOBILE_HACK_SLUG)
                    .eq("status", "approved");

                const runRows = unwrap(runsRes, "Failed to load timeline") || [];
                setRuns(runRows.map(mapRunRow));
            } catch (loadError) {
                setError(loadError.message || "Could not load timeline.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const recentRuns = useMemo(
        () => [...runs]
            .sort((left, right) => getRunDateTimestamp(right) - getRunDateTimestamp(left))
            .slice(0, 80),
        [runs]
    );

    const toggleVideo = (runId) => {
        setOpenVideoRunId((prev) => (prev === runId ? "" : runId));
    };

    return (
        <section>
            <div className="timeline-header">Recent Activity (Verified Runs)</div>

            {loading && <p className="status-line">Loading timeline...</p>}
            {error && <p className="error-text">{error}</p>}

            {!loading && !setupReady && (
                <p className="status-line">Moderator must initialize this site in the Mod Queue page.</p>
            )}

            {!loading && setupReady && recentRuns.length === 0 && (
                <p className="status-line">No approved runs yet.</p>
            )}

            {!loading && setupReady && recentRuns.map((run) => {
                const course = getCourseById(getRunCourseId(run));
                const starName = getRunStarName(run) || "Unknown Star";
                const tag = getTimelineTag(run, runs);
                const embedUrl = getVideoEmbedUrl(run.videoUrl);
                const isOpen = openVideoRunId === run.id;

                return (
                    <article key={run.id} className="timeline-card">
                        <div className="timeline-icon-container">trophy</div>

                        <div className="timeline-content">
                            <div className="timeline-head-row">
                                <h4>{tag} {course?.code || "SM64"} - {starName}</h4>
                                <span>{formatDate(run.dateAchieved)}</span>
                            </div>

                            <p>
                                <strong>{run.playerName}</strong> set <strong>{getRunIgt(run)}</strong>
                            </p>

                            <div className="timeline-actions">
                                {run.videoUrl && embedUrl && (
                                    <button
                                        type="button"
                                        className={`btn-timeline-action ${isOpen ? "active" : ""}`}
                                        onClick={() => toggleVideo(run.id)}
                                    >
                                        {isOpen ? "Close Video" : "Watch Video"}
                                    </button>
                                )}

                                {run.videoUrl && !embedUrl && (
                                    <a href={run.videoUrl} target="_blank" rel="noreferrer" className="btn-timeline-action">
                                        Open Video
                                    </a>
                                )}
                            </div>

                            {isOpen && embedUrl && (
                                <div className="timeline-video-embed">
                                    <iframe
                                        title={`video-${run.id}`}
                                        src={embedUrl}
                                        allowFullScreen
                                    />
                                </div>
                            )}
                        </div>
                    </article>
                );
            })}
        </section>
    );
}
