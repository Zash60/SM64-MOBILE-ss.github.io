import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SubmitRunModal from "../components/SubmitRunModal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { hasSupabase, supabase } from "../lib/supabase";
import {
    formatDate,
    formatTime,
    getTypeLabel,
    mapCategoryRow,
    mapHackRow,
    mapLevelRow,
    mapOptionRow,
    mapRunRow,
    mapStarRow,
    mapVariableRow,
    unwrap
} from "../lib/utils";

function sortByOrder(items) {
    return [...items].sort((a, b) => (a.order || 999) - (b.order || 999));
}

function isGlobalVariable(variable) {
    return !variable?.category_id;
}

export default function HackPage({ onOpenAuth }) {
    const { slug } = useParams();
    const { user, isModerator } = useAuth();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [hack, setHack] = useState(null);
    const [categories, setCategories] = useState([]);
    const [levels, setLevels] = useState([]);
    const [variables, setVariables] = useState([]);
    const [options, setOptions] = useState([]);
    const [stars, setStars] = useState([]);

    const [selectedType, setSelectedType] = useState("fullgame");
    const [selectedCategoryId, setSelectedCategoryId] = useState("");
    const [selectedLevelId, setSelectedLevelId] = useState("");
    const [selectedStarId, setSelectedStarId] = useState("");
    const [variableFilters, setVariableFilters] = useState({});

    const [runs, setRuns] = useState([]);
    const [runsLoading, setRunsLoading] = useState(false);

    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [refreshToken, setRefreshToken] = useState(0);

    const decodedSlug = useMemo(() => {
        try {
            return decodeURIComponent(slug || "");
        } catch (_error) {
            return slug || "";
        }
    }, [slug]);

    const categoriesByType = useMemo(() => {
        const grouped = {
            fullgame: [],
            level_rta: [],
            level_singlestar: []
        };

        categories.forEach((category) => {
            if (!grouped[category.type]) grouped[category.type] = [];
            grouped[category.type].push(category);
        });

        Object.keys(grouped).forEach((key) => {
            grouped[key] = sortByOrder(grouped[key]);
        });

        return grouped;
    }, [categories]);

    const availableTypes = useMemo(() => {
        const types = Array.from(new Set(categories.map((category) => category.type)));
        return types.length > 0 ? types : ["fullgame"];
    }, [categories]);

    const activeCategory = useMemo(() => {
        if (selectedType === "fullgame") {
            return categoriesByType.fullgame.find((category) => category.id === selectedCategoryId) || null;
        }
        return categoriesByType[selectedType]?.[0] || null;
    }, [categoriesByType, selectedCategoryId, selectedType]);

    const fullgameVariables = useMemo(
        () => sortByOrder(
            variables.filter((variable) => (
                variable.category_id === selectedCategoryId || isGlobalVariable(variable)
            ))
        ),
        [selectedCategoryId, variables]
    );

    const levelStarVariable = useMemo(() => {
        if (selectedType !== "level_singlestar" || !activeCategory) return null;

        const categoryVariables = sortByOrder(variables.filter((variable) => variable.category_id === activeCategory.id));
        return categoryVariables.find((variable) => variable.name.toLowerCase().includes("star")) || categoryVariables[0] || null;
    }, [activeCategory, selectedType, variables]);

    const starsForLevel = useMemo(
        () => sortByOrder(stars.filter((star) => star.level_id === selectedLevelId)),
        [selectedLevelId, stars]
    );

    const optionsByVariable = useMemo(() => {
        const grouped = {};
        options.forEach((option) => {
            if (!grouped[option.variable_id]) {
                grouped[option.variable_id] = [];
            }
            grouped[option.variable_id].push(option);
        });

        Object.keys(grouped).forEach((variableId) => {
            grouped[variableId].sort((a, b) => (a.order || 999) - (b.order || 999));
        });

        return grouped;
    }, [options]);

    useEffect(() => {
        const loadHackData = async () => {
            if (!hasSupabase || !supabase) {
                setLoading(false);
                setError("Supabase is not configured.");
                return;
            }

            try {
                setLoading(true);
                setError("");

                const hackRes = await supabase
                    .from("hacks")
                    .select("*")
                    .eq("slug", decodedSlug)
                    .maybeSingle();

                const hackRow = unwrap(hackRes, "Failed to load hack");
                if (!hackRow) {
                    throw new Error("Hack not found.");
                }

                const mappedHack = mapHackRow(hackRow);
                setHack(mappedHack);

                const [catsRes, levelsRes, varsRes] = await Promise.all([
                    supabase.from("categories").select("*").eq("hack_id", mappedHack.id),
                    supabase.from("levels").select("*").eq("hack_id", mappedHack.id),
                    supabase.from("variables").select("*").eq("hack_id", mappedHack.id)
                ]);

                const catRows = unwrap(catsRes, "Failed to load categories") || [];
                const levelRows = unwrap(levelsRes, "Failed to load levels") || [];
                const variableRows = unwrap(varsRes, "Failed to load variables") || [];

                const mappedCategories = catRows.map(mapCategoryRow);
                const mappedLevels = levelRows.map(mapLevelRow);
                const mappedVariables = variableRows.map(mapVariableRow);

                setCategories(mappedCategories);
                setLevels(sortByOrder(mappedLevels));
                setVariables(mappedVariables);

                if (mappedVariables.length > 0) {
                    const variableIds = mappedVariables.map((variable) => variable.id);
                    const optionsRes = await supabase
                        .from("options")
                        .select("*")
                        .in("variable_id", variableIds);
                    const optionRows = unwrap(optionsRes, "Failed to load options") || [];
                    setOptions(optionRows.map(mapOptionRow));
                } else {
                    setOptions([]);
                }

                if (mappedLevels.length > 0) {
                    const levelIds = mappedLevels.map((level) => level.id);
                    const starsRes = await supabase
                        .from("stars")
                        .select("*")
                        .in("level_id", levelIds);
                    const starRows = unwrap(starsRes, "Failed to load stars") || [];
                    setStars(starRows.map(mapStarRow));
                } else {
                    setStars([]);
                }

                const defaultType = Array.from(new Set(mappedCategories.map((category) => category.type)))[0] || "fullgame";
                setSelectedType(defaultType);
                setSelectedCategoryId(sortByOrder(mappedCategories.filter((category) => category.type === "fullgame"))[0]?.id || "");
                setSelectedLevelId(sortByOrder(mappedLevels)[0]?.id || "");
                setSelectedStarId("");
                setVariableFilters({});
            } catch (loadError) {
                setError(loadError.message || "Failed to load hack details.");
            } finally {
                setLoading(false);
            }
        };

        loadHackData();
    }, [decodedSlug]);

    useEffect(() => {
        if (selectedType === "fullgame") {
            if (!categoriesByType.fullgame.some((category) => category.id === selectedCategoryId)) {
                setSelectedCategoryId(categoriesByType.fullgame[0]?.id || "");
            }
        } else {
            setSelectedCategoryId("");
        }

        if (!levels.some((level) => level.id === selectedLevelId)) {
            setSelectedLevelId(levels[0]?.id || "");
        }

        setVariableFilters({});
        setSelectedStarId("");
    }, [categoriesByType, levels, selectedCategoryId, selectedLevelId, selectedType]);

    useEffect(() => {
        if (!starsForLevel.some((star) => star.id === selectedStarId)) {
            setSelectedStarId(starsForLevel[0]?.id || "");
        }
    }, [selectedStarId, starsForLevel]);

    useEffect(() => {
        if (selectedType !== "fullgame") return;

        setVariableFilters((prev) => {
            const next = {};

            fullgameVariables.forEach((variable) => {
                const variableOptions = optionsByVariable[variable.id] || [];
                if (variableOptions.length === 0) return;

                const current = prev[variable.id];
                const hasCurrent = current && variableOptions.some((option) => option.id === current);
                next[variable.id] = hasCurrent ? current : variableOptions[0].id;
            });

            const prevKeys = Object.keys(prev);
            const nextKeys = Object.keys(next);
            const changed = prevKeys.length !== nextKeys.length
                || nextKeys.some((key) => prev[key] !== next[key]);

            return changed ? next : prev;
        });
    }, [fullgameVariables, optionsByVariable, selectedType]);

    useEffect(() => {
        const loadRuns = async () => {
            if (!hasSupabase || !supabase || !hack || !activeCategory) {
                setRuns([]);
                return;
            }

            try {
                setRunsLoading(true);

                let query = supabase
                    .from("runs")
                    .select("*")
                    .eq("hack_id", hack.id)
                    .eq("category_id", activeCategory.id);

                if (!isModerator) {
                    query = query.eq("status", "approved");
                }

                const runsRes = await query;
                const runRows = unwrap(runsRes, "Failed to load runs") || [];

                let nextRuns = runRows.map(mapRunRow);

                if (!isModerator) {
                    nextRuns = nextRuns.filter((run) => run.status === "approved");
                }

                if (selectedType !== "fullgame" && selectedLevelId) {
                    nextRuns = nextRuns.filter((run) => run.variables?.level === selectedLevelId);
                }

                if (selectedType === "level_singlestar" && levelStarVariable && selectedStarId) {
                    nextRuns = nextRuns.filter((run) => run.variables?.[levelStarVariable.id] === selectedStarId);
                }

                if (selectedType === "fullgame") {
                    Object.entries(variableFilters).forEach(([variableId, optionId]) => {
                        if (optionId) {
                            nextRuns = nextRuns.filter((run) => run.variables?.[variableId] === optionId);
                        }
                    });
                }

                nextRuns.sort((a, b) => a.timeInMs - b.timeInMs);
                setRuns(nextRuns);
            } catch (runError) {
                showToast(runError.message || "Failed to load leaderboard.", "error", 5000);
                setRuns([]);
            } finally {
                setRunsLoading(false);
            }
        };

        loadRuns();
    }, [
        activeCategory,
        hack,
        isModerator,
        levelStarVariable,
        refreshToken,
        selectedLevelId,
        selectedStarId,
        selectedType,
        showToast,
        variableFilters
    ]);

    const requestOpenSubmitModal = () => {
        if (!user) {
            onOpenAuth();
            return;
        }
        setShowSubmitModal(true);
    };

    if (loading) {
        return (
            <section className="card">
                <p>Loading hack details...</p>
            </section>
        );
    }

    if (error) {
        return (
            <section className="card">
                <h2>Unable to open hack</h2>
                <p className="error-text">{error}</p>
                <p><Link to="/">Back to Home</Link></p>
            </section>
        );
    }

    if (!hack) {
        return null;
    }

    return (
        <section className="page-hack-details">
            <div className="card">
                <div className="section-head">
                    <h2>{hack.name}</h2>
                    <button type="button" className="btn btn-primary" onClick={requestOpenSubmitModal}>
                        Submit Run
                    </button>
                </div>

                <div className="form-grid three-col">
                    <label>
                        Leaderboard Type
                        <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
                            {availableTypes.map((type) => (
                                <option key={type} value={type}>
                                    {getTypeLabel(type)}
                                </option>
                            ))}
                        </select>
                    </label>

                    {selectedType === "fullgame" && (
                        <label>
                            Category
                            <select
                                value={selectedCategoryId}
                                onChange={(event) => {
                                    setSelectedCategoryId(event.target.value);
                                    setVariableFilters({});
                                }}
                            >
                                {categoriesByType.fullgame.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {selectedType !== "fullgame" && (
                        <label>
                            Level
                            <select value={selectedLevelId} onChange={(event) => setSelectedLevelId(event.target.value)}>
                                {levels.map((level) => (
                                    <option key={level.id} value={level.id}>
                                        {level.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {selectedType === "level_singlestar" && (
                        <label>
                            Star
                            <select value={selectedStarId} onChange={(event) => setSelectedStarId(event.target.value)}>
                                {starsForLevel.length === 0 && <option value="">No stars</option>}
                                {starsForLevel.map((star) => (
                                    <option key={star.id} value={star.id}>
                                        {star.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {selectedType === "fullgame" && fullgameVariables.map((variable) => (
                        <label key={variable.id}>
                            {variable.name}
                            <select
                                value={variableFilters[variable.id] || optionsByVariable[variable.id]?.[0]?.id || ""}
                                onChange={(event) => setVariableFilters((prev) => ({ ...prev, [variable.id]: event.target.value }))}
                            >
                                {(optionsByVariable[variable.id] || []).map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ))}
                </div>
            </div>

            <div className="card">
                <h3>Leaderboard</h3>

                {runsLoading && <p>Loading leaderboard...</p>}
                {!runsLoading && runs.length === 0 && <p>No runs available for this filter.</p>}

                {!runsLoading && runs.length > 0 && (
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Player</th>
                                    <th>Time</th>
                                    <th>Date</th>
                                    <th>Video</th>
                                    {isModerator && <th>Status</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {runs.map((run, index) => (
                                    <tr key={run.id} className={index === 0 ? "is-wr" : ""}>
                                        <td>{index + 1}</td>
                                        <td>{run.playerName}</td>
                                        <td>{formatTime(run.timeInMs)}</td>
                                        <td>{formatDate(run.dateAchieved)}</td>
                                        <td>
                                            {run.videoUrl
                                                ? <a href={run.videoUrl} target="_blank" rel="noreferrer">Watch</a>
                                                : "-"}
                                        </td>
                                        {isModerator && <td><span className={`status ${run.status}`}>{run.status}</span></td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <SubmitRunModal
                open={showSubmitModal}
                onClose={() => setShowSubmitModal(false)}
                hack={hack}
                categories={categories}
                levels={levels}
                variables={variables}
                options={options}
                stars={stars}
                onSubmitted={() => setRefreshToken((prev) => prev + 1)}
            />
        </section>
    );
}
