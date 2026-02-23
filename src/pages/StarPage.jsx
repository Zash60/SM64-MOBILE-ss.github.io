import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getCourseById, getStarName } from "../data/courses";
import {
    MOBILE_HACK_SLUG,
    getRunDateTimestamp,
    getRunIgt,
    getRunRta,
    getVideoEmbedUrl,
    loadMobileSetup,
    matchesStar
} from "../lib/mobileRecords";
import { hasSupabase, supabase } from "../lib/supabase";
import { formatDate, mapRunRow, unwrap } from "../lib/utils";

export default function StarPage() {
    const { courseId = "", starIndex = "1" } = useParams();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [setupReady, setSetupReady] = useState(false);
    const [runs, setRuns] = useState([]);
    const [selectedRunId, setSelectedRunId] = useState("");

    const parsedStarIndex = Number(starIndex);
    const course = getCourseById(courseId);
    const starName = getStarName(courseId, parsedStarIndex);

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

                const runRows = unwrap(runsRes, "Failed to load star history") || [];
                setRuns(runRows.map(mapRunRow));
            } catch (loadError) {
                setError(loadError.message || "Could not load star history.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const starRuns = useMemo(() => (
        runs
            .filter((run) => matchesStar(run, courseId, parsedStarIndex))
            .sort((left, right) => getRunDateTimestamp(right) - getRunDateTimestamp(left))
    ), [courseId, parsedStarIndex, runs]);

    const bestRun = useMemo(() => {
        if (starRuns.length === 0) return null;

        return [...starRuns].sort((left, right) => left.timeInMs - right.timeInMs)[0] || null;
    }, [starRuns]);

    useEffect(() => {
        if (!bestRun) {
            setSelectedRunId("");
            return;
        }

        setSelectedRunId(bestRun.id);
    }, [bestRun]);

    const selectedRun = starRuns.find((run) => run.id === selectedRunId) || bestRun;
    const embedUrl = selectedRun ? getVideoEmbedUrl(selectedRun.videoUrl) : "";

    return (
        <section className="detail-page">
            <Link to="/" className="back-link">Back to Courses</Link>

            {!course || !starName ? (
                <article className="course-section">
                    <div className="course-header bg-secret">Star Not Found</div>
                    <div className="course-body">Invalid course or star.</div>
                </article>
            ) : (
                <article className="course-section">
                    <div className={`course-header ${course.colorClass}`}>{starName}</div>

                    {selectedRun && (
                        <div className="video-block">
                            {embedUrl ? (
                                <div className="video-container">
                                    <iframe title="selected-run-video" src={embedUrl} allowFullScreen />
                                </div>
                            ) : (
                                <div className="video-empty">No embeddable video for selected run.</div>
                            )}

                            <p className="video-caption">
                                Best run by <strong>{selectedRun.playerName}</strong> in <strong>{getRunIgt(selectedRun)}</strong>
                            </p>
                        </div>
                    )}

                    {loading && <p className="status-line">Loading star history...</p>}
                    {error && <p className="error-text">{error}</p>}
                    {!loading && !setupReady && <p className="status-line">Moderator must initialize this site in Mod Queue.</p>}
                    {!loading && setupReady && starRuns.length === 0 && <p className="status-line">No runs submitted for this star.</p>}

                    {!loading && setupReady && starRuns.length > 0 && (
                        <div className="table-responsive">
                            <table className="records-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Player</th>
                                        <th>RT</th>
                                        <th>IGT</th>
                                        <th>Video</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {starRuns.map((run) => (
                                        <tr
                                            key={run.id}
                                            className={run.id === selectedRunId ? "row-selected" : ""}
                                            onClick={() => setSelectedRunId(run.id)}
                                        >
                                            <td>{formatDate(run.dateAchieved)}</td>
                                            <td>{run.playerName}</td>
                                            <td>{getRunRta(run)}</td>
                                            <td>{getRunIgt(run)}</td>
                                            <td>
                                                {run.videoUrl
                                                    ? <a href={run.videoUrl} target="_blank" rel="noreferrer">Open</a>
                                                    : "-"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </article>
            )}
        </section>
    );
}
