import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { COURSES } from "../data/courses";
import { MOBILE_HACK_SLUG, getRunCourseId, getRunIgt, getRunRta, getRunStarIndex, loadMobileSetup } from "../lib/mobileRecords";
import { hasSupabase, supabase } from "../lib/supabase";
import { formatDate, mapRunRow, unwrap } from "../lib/utils";

function getStarKey(courseId, starIndex) {
    return `${courseId}:${starIndex}`;
}

export default function CoursesPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [setupReady, setSetupReady] = useState(false);
    const [runs, setRuns] = useState([]);

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

                const runRows = unwrap(runsRes, "Failed to load runs") || [];
                setRuns(runRows.map(mapRunRow));
            } catch (loadError) {
                setError(loadError.message || "Could not load records.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const bestRunByStar = useMemo(() => {
        const map = {};

        runs.forEach((run) => {
            const courseId = getRunCourseId(run);
            const starIndex = getRunStarIndex(run);
            if (!courseId || !starIndex) return;

            const key = getStarKey(courseId, starIndex);
            const currentBest = map[key];
            if (!currentBest || run.timeInMs < currentBest.timeInMs) {
                map[key] = run;
            }
        });

        return map;
    }, [runs]);

    if (!hasSupabase) {
        return (
            <section className="course-section">
                <div className="course-header bg-secret">Supabase Setup Required</div>
                <div className="course-body">
                    Configure <code>config.js</code> before using this site.
                </div>
            </section>
        );
    }

    return (
        <section>
            {loading && <p className="status-line">Loading records...</p>}
            {error && <p className="error-text">{error}</p>}

            {!loading && !setupReady && (
                <section className="course-section">
                    <div className="course-header bg-secret">Site Setup Missing</div>
                    <div className="course-body">
                        Moderator must initialize this site in the Mod Queue page.
                    </div>
                </section>
            )}

            {!loading && setupReady && COURSES.map((course) => (
                <article className="course-section" key={course.id}>
                    <div className={`course-header ${course.colorClass}`}>{course.name}</div>

                    <div className="table-responsive">
                        <table className="records-table">
                            <thead>
                                <tr>
                                    <th>Star</th>
                                    <th>Player</th>
                                    <th>RT</th>
                                    <th>IGT</th>
                                    <th>Date</th>
                                </tr>
                            </thead>

                            <tbody>
                                {course.stars.map((starName, index) => {
                                    const starIndex = index + 1;
                                    const key = getStarKey(course.id, starIndex);
                                    const wr = bestRunByStar[key];

                                    return (
                                        <tr key={`${course.id}-${starIndex}`}>
                                            <td>
                                                <Link className="star-link" to={`/star/${course.id}/${starIndex}`}>
                                                    {starName}
                                                </Link>
                                            </td>
                                            {wr ? (
                                                <>
                                                    <td>{wr.playerName}</td>
                                                    <td>{getRunRta(wr)}</td>
                                                    <td>{getRunIgt(wr)}</td>
                                                    <td>{formatDate(wr.dateAchieved)}</td>
                                                </>
                                            ) : (
                                                <td colSpan={4} className="empty-run">-</td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </article>
            ))}
        </section>
    );
}
