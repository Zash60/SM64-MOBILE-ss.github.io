import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { supabase } from "../lib/supabase";
import {
    generatePBKey,
    getTypeLabel,
    parseTimeToMilliseconds,
    toRunRow
} from "../lib/utils";

import Modal from "./Modal";

function isGlobalVariable(variable) {
    return !variable?.category_id;
}

export default function SubmitRunModal({
    open,
    onClose,
    hack,
    categories,
    levels,
    variables,
    options,
    stars,
    onSubmitted
}) {
    const { user, profile } = useAuth();
    const { showToast } = useToast();

    const [runType, setRunType] = useState("fullgame");
    const [categoryId, setCategoryId] = useState("");
    const [levelId, setLevelId] = useState("");
    const [starId, setStarId] = useState("");
    const [playerName, setPlayerName] = useState("");
    const [timeInput, setTimeInput] = useState("");
    const [dateAchieved, setDateAchieved] = useState(new Date().toISOString().split("T")[0]);
    const [videoUrl, setVideoUrl] = useState("");
    const [variableValues, setVariableValues] = useState({});
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const typeOptions = useMemo(() => {
        const types = Array.from(new Set((categories || []).map((category) => category.type)));
        return types.length > 0 ? types : ["fullgame"];
    }, [categories]);

    const categoriesByType = useMemo(() => {
        const grouped = {
            fullgame: [],
            level_rta: [],
            level_singlestar: []
        };

        (categories || []).forEach((category) => {
            if (!grouped[category.type]) grouped[category.type] = [];
            grouped[category.type].push(category);
        });

        Object.keys(grouped).forEach((key) => {
            grouped[key].sort((a, b) => (a.order || 999) - (b.order || 999));
        });

        return grouped;
    }, [categories]);

    const activeCategory = useMemo(() => {
        if (runType === "fullgame") {
            return categoriesByType.fullgame.find((category) => category.id === categoryId) || null;
        }
        return categoriesByType[runType]?.[0] || null;
    }, [categoriesByType, categoryId, runType]);

    const fullgameVariables = useMemo(
        () => (variables || [])
            .filter((variable) => variable.category_id === categoryId || isGlobalVariable(variable))
            .sort((a, b) => (a.order || 999) - (b.order || 999)),
        [categoryId, variables]
    );

    const levelStarVariable = useMemo(() => {
        if (runType !== "level_singlestar" || !activeCategory) return null;

        const categoryVariables = (variables || [])
            .filter((variable) => variable.category_id === activeCategory.id)
            .sort((a, b) => (a.order || 999) - (b.order || 999));

        return categoryVariables.find((variable) => variable.name.toLowerCase().includes("star")) || categoryVariables[0] || null;
    }, [activeCategory, runType, variables]);

    const starsForLevel = useMemo(
        () => (stars || [])
            .filter((star) => star.level_id === levelId)
            .sort((a, b) => (a.order || 999) - (b.order || 999)),
        [levelId, stars]
    );

    const optionsByVariable = useMemo(() => {
        const grouped = {};
        (options || []).forEach((option) => {
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
        if (!open) return;

        const defaultType = typeOptions[0] || "fullgame";
        const defaultCategory = categoriesByType.fullgame[0]?.id || "";
        const defaultLevel = (levels || []).slice().sort((a, b) => (a.order || 999) - (b.order || 999))[0]?.id || "";

        setRunType(defaultType);
        setCategoryId(defaultCategory);
        setLevelId(defaultLevel);
        setStarId("");
        setVariableValues({});
        setTimeInput("");
        setDateAchieved(new Date().toISOString().split("T")[0]);
        setVideoUrl("");
        setPlayerName(profile?.username || user?.displayName || "");
        setError("");
        setSubmitting(false);
    }, [categoriesByType.fullgame, levels, open, profile?.username, typeOptions, user?.displayName]);

    useEffect(() => {
        if (runType === "fullgame") {
            if (!categoriesByType.fullgame.find((category) => category.id === categoryId)) {
                setCategoryId(categoriesByType.fullgame[0]?.id || "");
            }
        } else {
            setCategoryId("");
        }

        setVariableValues({});
        setStarId("");
    }, [categoriesByType, categoryId, runType]);

    useEffect(() => {
        if (!starsForLevel.find((star) => star.id === starId)) {
            setStarId(starsForLevel[0]?.id || "");
        }
    }, [starId, starsForLevel]);

    useEffect(() => {
        if (!open || runType !== "fullgame") return;

        setVariableValues((prev) => {
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
    }, [fullgameVariables, open, optionsByVariable, runType]);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!supabase) {
            setError("Supabase is not configured.");
            return;
        }

        if (!hack) {
            setError("No hack selected.");
            return;
        }

        const timeInMs = parseTimeToMilliseconds(timeInput);
        if (Number.isNaN(timeInMs) || timeInMs < 0) {
            setError("Invalid time format. Use 1:23.456 or 83.456");
            return;
        }

        if (!activeCategory) {
            setError("No category available for this type.");
            return;
        }

        const variablesPayload = {};

        if (runType === "fullgame") {
            fullgameVariables.forEach((variable) => {
                const selectedOptionId = variableValues[variable.id] || optionsByVariable[variable.id]?.[0]?.id || "";
                if (selectedOptionId) {
                    variablesPayload[variable.id] = selectedOptionId;
                }
            });
        } else {
            if (!levelId) {
                setError("Select a level.");
                return;
            }
            variablesPayload.level = levelId;

            if (runType === "level_singlestar" && levelStarVariable && starId) {
                variablesPayload[levelStarVariable.id] = starId;
            }
        }

        const runPayload = {
            hack_id: hack.id,
            hack_slug: hack.slug,
            category_id: activeCategory.id,
            hackName: hack.name,
            categoryName: activeCategory.name,
            playerName: playerName.trim() || "Anonymous",
            userId: user?.id || "anonymous",
            timeInMs,
            dateAchieved,
            videoUrl,
            variables: variablesPayload,
            status: "pending",
            submittedAt: new Date().toISOString()
        };

        runPayload.pb_key = generatePBKey(runPayload);

        try {
            setSubmitting(true);
            setError("");

            const insertRes = await supabase
                .from("runs")
                .insert(toRunRow(runPayload));

            if (insertRes.error) {
                throw insertRes.error;
            }

            showToast("Run submitted for review!", "success");
            onClose();
            if (onSubmitted) {
                onSubmitted();
            }
        } catch (submitError) {
            setError(submitError.message || "Failed to submit run.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title={`Submit Run - ${hack?.name || ""}`} wide>
            <form className="form" onSubmit={handleSubmit}>
                <div className="form-grid two-col">
                    <label>
                        Leaderboard Type
                        <select value={runType} onChange={(event) => setRunType(event.target.value)}>
                            {typeOptions.map((type) => (
                                <option key={type} value={type}>
                                    {getTypeLabel(type)}
                                </option>
                            ))}
                        </select>
                    </label>

                    {runType === "fullgame" && (
                        <label>
                            Category
                            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
                                {(categoriesByType.fullgame || []).map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {runType !== "fullgame" && (
                        <label>
                            Level
                            <select value={levelId} onChange={(event) => setLevelId(event.target.value)} required>
                                {(levels || []).slice().sort((a, b) => (a.order || 999) - (b.order || 999)).map((level) => (
                                    <option key={level.id} value={level.id}>
                                        {level.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {runType === "level_singlestar" && (
                        <label>
                            Star
                            <select value={starId} onChange={(event) => setStarId(event.target.value)}>
                                {starsForLevel.length === 0 && <option value="">No stars found</option>}
                                {starsForLevel.map((star) => (
                                    <option key={star.id} value={star.id}>
                                        {star.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {runType === "fullgame" && fullgameVariables.map((variable) => (
                        <label key={variable.id}>
                            {variable.name}
                            <select
                                value={variableValues[variable.id] || optionsByVariable[variable.id]?.[0]?.id || ""}
                                onChange={(event) => setVariableValues((prev) => ({ ...prev, [variable.id]: event.target.value }))}
                            >
                                {(optionsByVariable[variable.id] || []).map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ))}

                    <label>
                        Player Name
                        <input
                            type="text"
                            value={playerName}
                            onChange={(event) => setPlayerName(event.target.value)}
                            required
                        />
                    </label>

                    <label>
                        Time
                        <input
                            type="text"
                            value={timeInput}
                            onChange={(event) => setTimeInput(event.target.value)}
                            placeholder="1:23.456"
                            required
                        />
                    </label>

                    <label>
                        Date Achieved
                        <input
                            type="date"
                            value={dateAchieved}
                            onChange={(event) => setDateAchieved(event.target.value)}
                            required
                        />
                    </label>

                    <label>
                        Video URL
                        <input
                            type="url"
                            value={videoUrl}
                            onChange={(event) => setVideoUrl(event.target.value)}
                            placeholder="https://..."
                            required
                        />
                    </label>
                </div>

                {error && <p className="error-text">{error}</p>}

                <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit for Review"}
                </button>
            </form>
        </Modal>
    );
}
