import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { hasSupabase, supabase } from "../lib/supabase";
import {
    formatDate,
    formatTime,
    generatePBKey,
    mapCategoryRow,
    mapHackRow,
    mapLevelRow,
    mapOptionRow,
    mapRunRow,
    mapStarRow,
    mapVariableRow,
    slugify,
    unwrap
} from "../lib/utils";

function parseYear(rawValue) {
    const trimmed = String(rawValue || "").trim();
    if (!trimmed) return null;

    const parsed = parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function parseSortOrder(rawValue, fallback = 999) {
    const trimmed = String(rawValue || "").trim();
    if (!trimmed) return fallback;

    const parsed = parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

function sortByOrder(items) {
    return [...items].sort((a, b) => {
        const left = a.order || 999;
        const right = b.order || 999;
        if (left !== right) return left - right;
        return String(a.name || "").localeCompare(String(b.name || ""));
    });
}

const CATEGORY_TYPE_OPTIONS = [
    { value: "fullgame", label: "Full Game" },
    { value: "level_rta", label: "Level RTA" },
    { value: "level_singlestar", label: "Single Star" }
];

function mapSpeedrunCategoryType(category) {
    if (category?.type !== "per-level") {
        return "fullgame";
    }

    const name = String(category?.name || "").toLowerCase();
    if (name.includes("single star") || name.includes("1 star") || name.includes("single-star")) {
        return "level_singlestar";
    }

    return "level_rta";
}

async function fetchSpeedrunJson(url, label) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`${label} failed (${response.status}).`);
    }

    return response.json();
}

export default function ModeratorPage() {
    const { ready, user, isModerator } = useAuth();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [runs, setRuns] = useState([]);
    const [hacks, setHacks] = useState([]);
    const [hacksById, setHacksById] = useState({});

    const [statusFilter, setStatusFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");

    const [newHackName, setNewHackName] = useState("");
    const [newHackYear, setNewHackYear] = useState("");
    const [newHackImage, setNewHackImage] = useState("");
    const [newHackSrcId, setNewHackSrcId] = useState("");

    const [selectedHackId, setSelectedHackId] = useState("");
    const [editHackName, setEditHackName] = useState("");
    const [editHackSlug, setEditHackSlug] = useState("");
    const [editHackYear, setEditHackYear] = useState("");
    const [editHackReleaseDate, setEditHackReleaseDate] = useState("");
    const [editHackImage, setEditHackImage] = useState("");
    const [editHackSrcId, setEditHackSrcId] = useState("");

    const [hackCategories, setHackCategories] = useState([]);
    const [hackLevels, setHackLevels] = useState([]);
    const [hackVariables, setHackVariables] = useState([]);
    const [hackOptions, setHackOptions] = useState([]);
    const [hackStars, setHackStars] = useState([]);

    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryType, setNewCategoryType] = useState("fullgame");
    const [newCategoryOrder, setNewCategoryOrder] = useState("");
    const [newCategorySrcId, setNewCategorySrcId] = useState("");

    const [newLevelName, setNewLevelName] = useState("");
    const [newLevelOrder, setNewLevelOrder] = useState("");
    const [newLevelSrcId, setNewLevelSrcId] = useState("");

    const [newVariableName, setNewVariableName] = useState("");
    const [newVariableCategoryId, setNewVariableCategoryId] = useState("");
    const [newVariableOrder, setNewVariableOrder] = useState("");
    const [newVariableSrcId, setNewVariableSrcId] = useState("");

    const [newOptionName, setNewOptionName] = useState("");
    const [newOptionVariableId, setNewOptionVariableId] = useState("");
    const [newOptionOrder, setNewOptionOrder] = useState("");
    const [newOptionSrcId, setNewOptionSrcId] = useState("");

    const [newStarName, setNewStarName] = useState("");
    const [newStarLevelId, setNewStarLevelId] = useState("");
    const [newStarOrder, setNewStarOrder] = useState("");
    const [newStarSrcId, setNewStarSrcId] = useState("");

    const [savingHack, setSavingHack] = useState(false);
    const [syncingHack, setSyncingHack] = useState(false);
    const [loadingHackData, setLoadingHackData] = useState(false);
    const [savingHackData, setSavingHackData] = useState(false);

    const loadModeratorData = async () => {
        if (!hasSupabase || !supabase) {
            setError("Supabase is not configured.");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError("");

            const [runsRes, hacksRes] = await Promise.all([
                supabase.from("runs").select("*").order("submitted_at", { ascending: false }),
                supabase.from("hacks").select("*")
            ]);

            const runRows = unwrap(runsRes, "Failed to load runs") || [];
            const hackRows = unwrap(hacksRes, "Failed to load hacks") || [];

            const mappedRuns = runRows.map(mapRunRow);
            const mappedHacks = hackRows
                .map(mapHackRow)
                .sort((a, b) => a.name.localeCompare(b.name));

            setRuns(mappedRuns);
            setHacks(mappedHacks);
            setHacksById(
                mappedHacks.reduce((acc, hack) => {
                    acc[hack.id] = hack;
                    return acc;
                }, {})
            );
            setSelectedHackId((prev) => {
                if (prev && mappedHacks.some((hack) => hack.id === prev)) {
                    return prev;
                }
                return mappedHacks[0]?.id || "";
            });
        } catch (loadError) {
            setError(loadError.message || "Could not load moderator panel.");
            showToast(loadError.message || "Could not load moderator panel.", "error", 5000);
        } finally {
            setLoading(false);
        }
    };

    const clearHackDataEditor = () => {
        setHackCategories([]);
        setHackLevels([]);
        setHackVariables([]);
        setHackOptions([]);
        setHackStars([]);
        setNewVariableCategoryId("");
        setNewOptionVariableId("");
        setNewStarLevelId("");
    };

    const loadHackDataEditor = async (hackId) => {
        if (!supabase || !hackId) {
            clearHackDataEditor();
            return;
        }

        try {
            setLoadingHackData(true);

            const [categoriesRes, levelsRes, variablesRes, starsRes] = await Promise.all([
                supabase.from("categories").select("*").eq("hack_id", hackId),
                supabase.from("levels").select("*").eq("hack_id", hackId),
                supabase.from("variables").select("*").eq("hack_id", hackId),
                supabase.from("stars").select("*").eq("hack_id", hackId)
            ]);

            const categoryRows = unwrap(categoriesRes, "Failed to load categories") || [];
            const levelRows = unwrap(levelsRes, "Failed to load levels") || [];
            const variableRows = unwrap(variablesRes, "Failed to load variables") || [];
            const starRows = unwrap(starsRes, "Failed to load stars") || [];

            const mappedCategories = sortByOrder(categoryRows.map(mapCategoryRow));
            const mappedLevels = sortByOrder(levelRows.map(mapLevelRow));
            const mappedVariables = sortByOrder(variableRows.map(mapVariableRow));
            const mappedStars = sortByOrder(starRows.map(mapStarRow));

            setHackCategories(mappedCategories);
            setHackLevels(mappedLevels);
            setHackVariables(mappedVariables);
            setHackStars(mappedStars);

            if (mappedVariables.length > 0) {
                const optionsRes = await supabase
                    .from("options")
                    .select("*")
                    .in("variable_id", mappedVariables.map((variable) => variable.id));

                const optionRows = unwrap(optionsRes, "Failed to load options") || [];
                setHackOptions(sortByOrder(optionRows.map(mapOptionRow)));
            } else {
                setHackOptions([]);
            }
        } catch (loadError) {
            showToast(loadError.message || "Could not load hack data.", "error", 5000);
            clearHackDataEditor();
        } finally {
            setLoadingHackData(false);
        }
    };

    useEffect(() => {
        if (!ready) return;

        if (!user || !isModerator) {
            setLoading(false);
            return;
        }

        loadModeratorData();
    }, [ready, user, isModerator]);

    useEffect(() => {
        const selectedHack = hacks.find((hack) => hack.id === selectedHackId);

        if (!selectedHack) {
            setEditHackName("");
            setEditHackSlug("");
            setEditHackYear("");
            setEditHackReleaseDate("");
            setEditHackImage("");
            setEditHackSrcId("");
            clearHackDataEditor();
            return;
        }

        setEditHackName(selectedHack.name || "");
        setEditHackSlug(selectedHack.slug || "");
        setEditHackYear(selectedHack.year ? String(selectedHack.year) : "");
        setEditHackReleaseDate(selectedHack.releaseDate || "");
        setEditHackImage(selectedHack.imageUrl || "");
        setEditHackSrcId(selectedHack.srcId || "");
    }, [hacks, selectedHackId]);

    const selectedHack = useMemo(
        () => hacks.find((hack) => hack.id === selectedHackId) || null,
        [hacks, selectedHackId]
    );

    useEffect(() => {
        if (!ready || !user || !isModerator) return;
        if (!selectedHackId) {
            clearHackDataEditor();
            return;
        }

        loadHackDataEditor(selectedHackId);
    }, [ready, user, isModerator, selectedHackId]);

    useEffect(() => {
        if (!hackCategories.some((category) => category.id === newVariableCategoryId)) {
            setNewVariableCategoryId("");
        }
    }, [hackCategories, newVariableCategoryId]);

    useEffect(() => {
        if (!hackVariables.some((variable) => variable.id === newOptionVariableId)) {
            setNewOptionVariableId(hackVariables[0]?.id || "");
        }
    }, [hackVariables, newOptionVariableId]);

    useEffect(() => {
        if (!hackLevels.some((level) => level.id === newStarLevelId)) {
            setNewStarLevelId(hackLevels[0]?.id || "");
        }
    }, [hackLevels, newStarLevelId]);

    const pendingRuns = useMemo(() => runs.filter((run) => run.status === "pending"), [runs]);

    const filteredRuns = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();

        return runs.filter((run) => {
            const matchesStatus = statusFilter === "all" || run.status === statusFilter;
            const matchesTerm =
                !term
                || run.playerName.toLowerCase().includes(term)
                || run.hackName.toLowerCase().includes(term)
                || run.categoryName.toLowerCase().includes(term);

            return matchesStatus && matchesTerm;
        });
    }, [runs, searchTerm, statusFilter]);

    const hackEditorDisabled = savingHack || syncingHack || savingHackData || loadingHackData;

    const updateCategoryDraft = (categoryId, field, value) => {
        setHackCategories((prev) => prev.map((category) => (
            category.id === categoryId
                ? { ...category, [field]: value }
                : category
        )));
    };

    const updateLevelDraft = (levelId, field, value) => {
        setHackLevels((prev) => prev.map((level) => (
            level.id === levelId
                ? { ...level, [field]: value }
                : level
        )));
    };

    const updateVariableDraft = (variableId, field, value) => {
        setHackVariables((prev) => prev.map((variable) => (
            variable.id === variableId
                ? { ...variable, [field]: value }
                : variable
        )));
    };

    const updateOptionDraft = (optionId, field, value) => {
        setHackOptions((prev) => prev.map((option) => (
            option.id === optionId
                ? { ...option, [field]: value }
                : option
        )));
    };

    const updateStarDraft = (starId, field, value) => {
        setHackStars((prev) => prev.map((star) => (
            star.id === starId
                ? { ...star, [field]: value }
                : star
        )));
    };

    const saveCategory = async (category) => {
        if (!supabase || !selectedHack) return;
        const name = String(category.name || "").trim();
        if (!name) {
            showToast("Category name is required.", "warning");
            return;
        }

        const type = CATEGORY_TYPE_OPTIONS.some((option) => option.value === category.type)
            ? category.type
            : "fullgame";

        try {
            setSavingHackData(true);
            const updateRes = await supabase
                .from("categories")
                .update({
                    name,
                    type,
                    sort_order: parseSortOrder(category.order, 999),
                    src_id: String(category.srcId || "").trim() || null
                })
                .eq("id", category.id);

            if (updateRes.error) {
                throw updateRes.error;
            }

            showToast("Category updated.", "success");
            await loadHackDataEditor(selectedHack.id);
        } catch (saveError) {
            showToast(saveError.message || "Could not update category.", "error", 5000);
        } finally {
            setSavingHackData(false);
        }
    };

    const deleteCategory = async (category) => {
        if (!supabase || !selectedHack) return;
        const confirmed = window.confirm(
            `Delete category "${category.name}"? This can remove related runs and variables.`
        );
        if (!confirmed) return;

        try {
            setSavingHackData(true);
            const deleteRes = await supabase
                .from("categories")
                .delete()
                .eq("id", category.id);

            if (deleteRes.error) {
                throw deleteRes.error;
            }

            showToast("Category deleted.", "info");
            await loadHackDataEditor(selectedHack.id);
        } catch (deleteError) {
            showToast(deleteError.message || "Could not delete category.", "error", 5000);
        } finally {
            setSavingHackData(false);
        }
    };

    const addCategory = async () => {
        if (!supabase || !selectedHack) return;

        const name = newCategoryName.trim();
        if (!name) {
            showToast("Category name is required.", "warning");
            return;
        }

        try {
            setSavingHackData(true);
            const insertRes = await supabase
                .from("categories")
                .insert({
                    hack_id: selectedHack.id,
                    name,
                    type: newCategoryType,
                    sort_order: parseSortOrder(newCategoryOrder, hackCategories.length + 1),
                    src_id: newCategorySrcId.trim() || null
                });

            if (insertRes.error) {
                throw insertRes.error;
            }

            setNewCategoryName("");
            setNewCategoryOrder("");
            setNewCategorySrcId("");
            showToast("Category added.", "success");
            await loadHackDataEditor(selectedHack.id);
        } catch (insertError) {
            showToast(insertError.message || "Could not add category.", "error", 5000);
        } finally {
            setSavingHackData(false);
        }
    };

    const saveLevel = async (level) => {
        if (!supabase || !selectedHack) return;
        const name = String(level.name || "").trim();
        if (!name) {
            showToast("Level name is required.", "warning");
            return;
        }

        try {
            setSavingHackData(true);
            const updateRes = await supabase
                .from("levels")
                .update({
                    name,
                    sort_order: parseSortOrder(level.order, 999),
                    src_id: String(level.srcId || "").trim() || null
                })
                .eq("id", level.id);

            if (updateRes.error) {
                throw updateRes.error;
            }

            showToast("Level updated.", "success");
            await loadHackDataEditor(selectedHack.id);
        } catch (saveError) {
            showToast(saveError.message || "Could not update level.", "error", 5000);
        } finally {
            setSavingHackData(false);
        }
    };

    const deleteLevel = async (level) => {
        if (!supabase || !selectedHack) return;
        const confirmed = window.confirm(`Delete level "${level.name}"? This also deletes related stars.`);
        if (!confirmed) return;

        try {
            setSavingHackData(true);
            const deleteRes = await supabase
                .from("levels")
                .delete()
                .eq("id", level.id);

            if (deleteRes.error) {
                throw deleteRes.error;
            }

            showToast("Level deleted.", "info");
            await loadHackDataEditor(selectedHack.id);
        } catch (deleteError) {
            showToast(deleteError.message || "Could not delete level.", "error", 5000);
        } finally {
            setSavingHackData(false);
        }
    };

    const addLevel = async () => {
        if (!supabase || !selectedHack) return;
        const name = newLevelName.trim();
        if (!name) {
            showToast("Level name is required.", "warning");
            return;
        }

        try {
            setSavingHackData(true);
            const insertRes = await supabase
                .from("levels")
                .insert({
                    hack_id: selectedHack.id,
                    name,
                    sort_order: parseSortOrder(newLevelOrder, hackLevels.length + 1),
                    src_id: newLevelSrcId.trim() || null
                });

            if (insertRes.error) {
                throw insertRes.error;
            }

            setNewLevelName("");
            setNewLevelOrder("");
            setNewLevelSrcId("");
            showToast("Level added.", "success");
            await loadHackDataEditor(selectedHack.id);
        } catch (insertError) {
            showToast(insertError.message || "Could not add level.", "error", 5000);
        } finally {
            setSavingHackData(false);
        }
    };

    const saveVariable = async (variable) => {
        if (!supabase || !selectedHack) return;
        const name = String(variable.name || "").trim();
        if (!name) {
            showToast("Variable name is required.", "warning");
            return;
        }

        try {
            setSavingHackData(true);
            const updateRes = await supabase
                .from("variables")
                .update({
                    name,
                    category_id: variable.category_id || null,
                    sort_order: parseSortOrder(variable.order, 999),
                    src_id: String(variable.srcId || "").trim() || null
                })
                .eq("id", variable.id);

            if (updateRes.error) {
                throw updateRes.error;
            }

            showToast("Variable updated.", "success");
            await loadHackDataEditor(selectedHack.id);
        } catch (saveError) {
            showToast(saveError.message || "Could not update variable.", "error", 5000);
        } finally {
            setSavingHackData(false);
        }
    };

    const deleteVariable = async (variable) => {
        if (!supabase || !selectedHack) return;
        const confirmed = window.confirm(
            `Delete variable "${variable.name}"? This also deletes related options.`
        );
        if (!confirmed) return;

        try {
            setSavingHackData(true);
            const deleteRes = await supabase
                .from("variables")
                .delete()
                .eq("id", variable.id);

            if (deleteRes.error) {
                throw deleteRes.error;
            }

            showToast("Variable deleted.", "info");
            await loadHackDataEditor(selectedHack.id);
        } catch (deleteError) {
            showToast(deleteError.message || "Could not delete variable.", "error", 5000);
        } finally {
            setSavingHackData(false);
        }
    };

    const addVariable = async () => {
        if (!supabase || !selectedHack) return;
        const name = newVariableName.trim();
        if (!name) {
            showToast("Variable name is required.", "warning");
            return;
        }

        try {
            setSavingHackData(true);
            const insertRes = await supabase
                .from("variables")
                .insert({
                    hack_id: selectedHack.id,
                    category_id: newVariableCategoryId || null,
                    name,
                    sort_order: parseSortOrder(newVariableOrder, hackVariables.length + 1),
                    src_id: newVariableSrcId.trim() || null
                });

            if (insertRes.error) {
                throw insertRes.error;
            }

            setNewVariableName("");
            setNewVariableOrder("");
            setNewVariableSrcId("");
            showToast("Variable added.", "success");
            await loadHackDataEditor(selectedHack.id);
        } catch (insertError) {
            showToast(insertError.message || "Could not add variable.", "error", 5000);
        } finally {
            setSavingHackData(false);
        }
    };

    const saveOption = async (option) => {
        if (!supabase || !selectedHack) return;
        const name = String(option.name || "").trim();
        if (!name) {
            showToast("Option name is required.", "warning");
            return;
        }

        if (!option.variable_id) {
            showToast("Select a variable for this option.", "warning");
            return;
        }

        try {
            setSavingHackData(true);
            const updateRes = await supabase
                .from("options")
                .update({
                    variable_id: option.variable_id,
                    name,
                    sort_order: parseSortOrder(option.order, 999),
                    src_id: String(option.srcId || "").trim() || null
                })
                .eq("id", option.id);

            if (updateRes.error) {
                throw updateRes.error;
            }

            showToast("Option updated.", "success");
            await loadHackDataEditor(selectedHack.id);
        } catch (saveError) {
            showToast(saveError.message || "Could not update option.", "error", 5000);
        } finally {
            setSavingHackData(false);
        }
    };

    const deleteOption = async (option) => {
        if (!supabase || !selectedHack) return;
        const confirmed = window.confirm(`Delete option "${option.name}"?`);
        if (!confirmed) return;

        try {
            setSavingHackData(true);
            const deleteRes = await supabase
                .from("options")
                .delete()
                .eq("id", option.id);

            if (deleteRes.error) {
                throw deleteRes.error;
            }

            showToast("Option deleted.", "info");
            await loadHackDataEditor(selectedHack.id);
        } catch (deleteError) {
            showToast(deleteError.message || "Could not delete option.", "error", 5000);
        } finally {
            setSavingHackData(false);
        }
    };

    const addOption = async () => {
        if (!supabase || !selectedHack) return;
        const name = newOptionName.trim();
        if (!name) {
            showToast("Option name is required.", "warning");
            return;
        }

        if (!newOptionVariableId) {
            showToast("Create a variable first, then add options.", "warning");
            return;
        }

        const optionsForVariable = hackOptions.filter((option) => option.variable_id === newOptionVariableId);

        try {
            setSavingHackData(true);
            const insertRes = await supabase
                .from("options")
                .insert({
                    variable_id: newOptionVariableId,
                    name,
                    sort_order: parseSortOrder(newOptionOrder, optionsForVariable.length + 1),
                    src_id: newOptionSrcId.trim() || null
                });

            if (insertRes.error) {
                throw insertRes.error;
            }

            setNewOptionName("");
            setNewOptionOrder("");
            setNewOptionSrcId("");
            showToast("Option added.", "success");
            await loadHackDataEditor(selectedHack.id);
        } catch (insertError) {
            showToast(insertError.message || "Could not add option.", "error", 5000);
        } finally {
            setSavingHackData(false);
        }
    };

    const saveStar = async (star) => {
        if (!supabase || !selectedHack) return;
        const name = String(star.name || "").trim();
        if (!name) {
            showToast("Star name is required.", "warning");
            return;
        }

        if (!star.level_id) {
            showToast("Select a level for this star.", "warning");
            return;
        }

        try {
            setSavingHackData(true);
            const updateRes = await supabase
                .from("stars")
                .update({
                    level_id: star.level_id,
                    name,
                    sort_order: parseSortOrder(star.order, 999),
                    src_id: String(star.srcId || "").trim() || null
                })
                .eq("id", star.id);

            if (updateRes.error) {
                throw updateRes.error;
            }

            showToast("Star updated.", "success");
            await loadHackDataEditor(selectedHack.id);
        } catch (saveError) {
            showToast(saveError.message || "Could not update star.", "error", 5000);
        } finally {
            setSavingHackData(false);
        }
    };

    const deleteStar = async (star) => {
        if (!supabase || !selectedHack) return;
        const confirmed = window.confirm(`Delete star "${star.name}"?`);
        if (!confirmed) return;

        try {
            setSavingHackData(true);
            const deleteRes = await supabase
                .from("stars")
                .delete()
                .eq("id", star.id);

            if (deleteRes.error) {
                throw deleteRes.error;
            }

            showToast("Star deleted.", "info");
            await loadHackDataEditor(selectedHack.id);
        } catch (deleteError) {
            showToast(deleteError.message || "Could not delete star.", "error", 5000);
        } finally {
            setSavingHackData(false);
        }
    };

    const addStar = async () => {
        if (!supabase || !selectedHack) return;
        const name = newStarName.trim();
        if (!name) {
            showToast("Star name is required.", "warning");
            return;
        }

        if (!newStarLevelId) {
            showToast("Create a level first, then add stars.", "warning");
            return;
        }

        const starsForLevel = hackStars.filter((star) => star.level_id === newStarLevelId);

        try {
            setSavingHackData(true);
            const insertRes = await supabase
                .from("stars")
                .insert({
                    hack_id: selectedHack.id,
                    level_id: newStarLevelId,
                    name,
                    sort_order: parseSortOrder(newStarOrder, starsForLevel.length + 1),
                    src_id: newStarSrcId.trim() || null
                });

            if (insertRes.error) {
                throw insertRes.error;
            }

            setNewStarName("");
            setNewStarOrder("");
            setNewStarSrcId("");
            showToast("Star added.", "success");
            await loadHackDataEditor(selectedHack.id);
        } catch (insertError) {
            showToast(insertError.message || "Could not add star.", "error", 5000);
        } finally {
            setSavingHackData(false);
        }
    };

    const moderateRun = async (run, newStatus) => {
        if (!supabase) return;

        try {
            const pbKey = run.pb_key || generatePBKey(run);
            const payload = { status: newStatus };

            if (newStatus === "approved") {
                payload.pb_key = pbKey;
            }

            const updateRes = await supabase
                .from("runs")
                .update(payload)
                .eq("id", run.id);

            if (updateRes.error) {
                throw updateRes.error;
            }

            if (newStatus === "approved") {
                const pbRunsRes = await supabase
                    .from("runs")
                    .select("*")
                    .eq("status", "approved")
                    .eq("pb_key", pbKey)
                    .order("time_in_ms", { ascending: true });

                const pbRows = unwrap(pbRunsRes, "Failed to recalculate PBs") || [];
                const obsoleteIds = pbRows.slice(1).map((row) => row.id);

                if (obsoleteIds.length > 0) {
                    const obsoleteRes = await supabase
                        .from("runs")
                        .update({ status: "obsolete" })
                        .in("id", obsoleteIds);

                    if (obsoleteRes.error) {
                        throw obsoleteRes.error;
                    }
                }
            }

            showToast(`Run updated to ${newStatus}.`, "success");
            await loadModeratorData();
        } catch (moderationError) {
            showToast(moderationError.message || "Could not update run.", "error", 5000);
        }
    };

    const deleteRun = async (run) => {
        if (!supabase) return;
        const confirmed = window.confirm(`Delete run from ${run.playerName}?`);
        if (!confirmed) return;

        try {
            const deleteRes = await supabase
                .from("runs")
                .delete()
                .eq("id", run.id);

            if (deleteRes.error) {
                throw deleteRes.error;
            }

            showToast("Run deleted.", "info");
            await loadModeratorData();
        } catch (deleteError) {
            showToast(deleteError.message || "Could not delete run.", "error", 5000);
        }
    };

    const addHack = async (event) => {
        event.preventDefault();
        if (!supabase) return;

        const name = newHackName.trim();
        if (!name) {
            showToast("Hack name is required.", "warning");
            return;
        }

        try {
            const insertRes = await supabase
                .from("hacks")
                .insert({
                    name,
                    slug: slugify(name),
                    year: parseYear(newHackYear),
                    image_url: newHackImage.trim() || null,
                    src_id: newHackSrcId.trim() || null
                });

            if (insertRes.error) {
                throw insertRes.error;
            }

            setNewHackName("");
            setNewHackYear("");
            setNewHackImage("");
            setNewHackSrcId("");

            showToast("Hack created.", "success");
            await loadModeratorData();
        } catch (insertError) {
            showToast(insertError.message || "Could not create hack.", "error", 5000);
        }
    };

    const saveHackChanges = async (event) => {
        event.preventDefault();
        if (!supabase || !selectedHack) return;

        const name = editHackName.trim();
        const slug = slugify(editHackSlug.trim() || name);

        if (!name) {
            showToast("Hack name is required.", "warning");
            return;
        }

        if (!slug) {
            showToast("Hack slug is required.", "warning");
            return;
        }

        try {
            setSavingHack(true);

            const updateRes = await supabase
                .from("hacks")
                .update({
                    name,
                    slug,
                    year: parseYear(editHackYear),
                    release_date: editHackReleaseDate || null,
                    image_url: editHackImage.trim() || null,
                    src_id: editHackSrcId.trim() || null
                })
                .eq("id", selectedHack.id);

            if (updateRes.error) {
                throw updateRes.error;
            }

            showToast("Hack updated.", "success");
            await loadModeratorData();
        } catch (updateError) {
            showToast(updateError.message || "Could not update hack.", "error", 5000);
        } finally {
            setSavingHack(false);
        }
    };

    const deleteHack = async () => {
        if (!supabase || !selectedHack) return;

        const confirmed = window.confirm(
            `Delete hack \"${selectedHack.name}\"? This also deletes categories, levels and runs linked to it.`
        );

        if (!confirmed) return;

        try {
            setSavingHack(true);
            const deleteRes = await supabase
                .from("hacks")
                .delete()
                .eq("id", selectedHack.id);

            if (deleteRes.error) {
                throw deleteRes.error;
            }

            showToast("Hack deleted.", "info");
            await loadModeratorData();
        } catch (deleteError) {
            showToast(deleteError.message || "Could not delete hack.", "error", 5000);
        } finally {
            setSavingHack(false);
        }
    };

    const syncHackFromSpeedrun = async () => {
        if (!supabase || !selectedHack) return;

        const srcId = editHackSrcId.trim();
        if (!srcId) {
            showToast("Set Speedrun Game ID before syncing.", "warning");
            return;
        }

        try {
            setSyncingHack(true);

            const encodedGameId = encodeURIComponent(srcId);
            const [gamePayload, categoriesPayload, levelsPayload, variablesPayload] = await Promise.all([
                fetchSpeedrunJson(`https://www.speedrun.com/api/v1/games/${encodedGameId}`, "Game sync"),
                fetchSpeedrunJson(`https://www.speedrun.com/api/v1/games/${encodedGameId}/categories`, "Categories sync"),
                fetchSpeedrunJson(`https://www.speedrun.com/api/v1/games/${encodedGameId}/levels`, "Levels sync"),
                fetchSpeedrunJson(`https://www.speedrun.com/api/v1/games/${encodedGameId}/variables`, "Variables sync")
            ]);

            const game = gamePayload?.data;
            const remoteCategories = Array.isArray(categoriesPayload?.data) ? categoriesPayload.data : [];
            const remoteLevels = Array.isArray(levelsPayload?.data) ? levelsPayload.data : [];
            const allRemoteVariables = Array.isArray(variablesPayload?.data) ? variablesPayload.data : [];
            const remoteVariables = allRemoteVariables.filter((variable) => variable?.id && variable?.name);

            if (!game) {
                throw new Error("Speedrun game was not found.");
            }

            const hackUpdateRes = await supabase
                .from("hacks")
                .update({
                    name: game.names?.international || editHackName.trim() || selectedHack.name,
                    year: typeof game.released === "number" ? game.released : parseYear(editHackYear),
                    release_date: game["release-date"] || editHackReleaseDate || null,
                    image_url: game.assets?.["cover-medium"]?.uri || game.assets?.cover?.uri || editHackImage.trim() || null,
                    src_id: srcId
                })
                .eq("id", selectedHack.id);

            if (hackUpdateRes.error) {
                throw hackUpdateRes.error;
            }

            const [existingCategoriesRes, existingLevelsRes, existingVariablesRes] = await Promise.all([
                supabase.from("categories").select("id, src_id").eq("hack_id", selectedHack.id),
                supabase.from("levels").select("id, src_id").eq("hack_id", selectedHack.id),
                supabase.from("variables").select("id, src_id").eq("hack_id", selectedHack.id)
            ]);

            const existingCategories = unwrap(existingCategoriesRes, "Could not read existing categories") || [];
            const existingLevels = unwrap(existingLevelsRes, "Could not read existing levels") || [];
            const existingVariables = unwrap(existingVariablesRes, "Could not read existing variables") || [];

            const categoryIdBySrc = {};
            for (let index = 0; index < remoteCategories.length; index += 1) {
                const remoteCategory = remoteCategories[index];
                const existing = existingCategories.find((category) => category.src_id === remoteCategory.id);
                const payload = {
                    hack_id: selectedHack.id,
                    name: remoteCategory.name || "Unnamed Category",
                    type: mapSpeedrunCategoryType(remoteCategory),
                    sort_order: index + 1,
                    src_id: remoteCategory.id
                };

                if (existing) {
                    const updateRes = await supabase
                        .from("categories")
                        .update(payload)
                        .eq("id", existing.id)
                        .select("id")
                        .single();

                    if (updateRes.error) {
                        throw updateRes.error;
                    }

                    categoryIdBySrc[remoteCategory.id] = updateRes.data.id;
                } else {
                    const insertRes = await supabase
                        .from("categories")
                        .insert(payload)
                        .select("id")
                        .single();

                    if (insertRes.error) {
                        throw insertRes.error;
                    }

                    categoryIdBySrc[remoteCategory.id] = insertRes.data.id;
                }
            }

            const levelIdBySrc = {};
            for (let index = 0; index < remoteLevels.length; index += 1) {
                const remoteLevel = remoteLevels[index];
                const existing = existingLevels.find((level) => level.src_id === remoteLevel.id);
                const payload = {
                    hack_id: selectedHack.id,
                    name: remoteLevel.name || "Unnamed Level",
                    sort_order: index + 1,
                    src_id: remoteLevel.id
                };

                if (existing) {
                    const updateRes = await supabase
                        .from("levels")
                        .update(payload)
                        .eq("id", existing.id)
                        .select("id")
                        .single();

                    if (updateRes.error) {
                        throw updateRes.error;
                    }

                    levelIdBySrc[remoteLevel.id] = updateRes.data.id;
                } else {
                    const insertRes = await supabase
                        .from("levels")
                        .insert(payload)
                        .select("id")
                        .single();

                    if (insertRes.error) {
                        throw insertRes.error;
                    }

                    levelIdBySrc[remoteLevel.id] = insertRes.data.id;
                }
            }

            const variableIdBySrc = {};
            for (let index = 0; index < remoteVariables.length; index += 1) {
                const remoteVariable = remoteVariables[index];
                const existing = existingVariables.find((variable) => variable.src_id === remoteVariable.id);

                const payload = {
                    hack_id: selectedHack.id,
                    category_id: remoteVariable.category ? categoryIdBySrc[remoteVariable.category] || null : null,
                    name: remoteVariable.name || "Unnamed Variable",
                    sort_order: index + 1,
                    src_id: remoteVariable.id
                };

                if (existing) {
                    const updateRes = await supabase
                        .from("variables")
                        .update(payload)
                        .eq("id", existing.id)
                        .select("id")
                        .single();

                    if (updateRes.error) {
                        throw updateRes.error;
                    }

                    variableIdBySrc[remoteVariable.id] = updateRes.data.id;
                } else {
                    const insertRes = await supabase
                        .from("variables")
                        .insert(payload)
                        .select("id")
                        .single();

                    if (insertRes.error) {
                        throw insertRes.error;
                    }

                    variableIdBySrc[remoteVariable.id] = insertRes.data.id;
                }
            }

            const localVariableIds = Object.values(variableIdBySrc);
            const existingOptionsRes = localVariableIds.length > 0
                ? await supabase
                    .from("options")
                    .select("id, variable_id, src_id")
                    .in("variable_id", localVariableIds)
                : { data: [], error: null };

            const existingOptions = unwrap(existingOptionsRes, "Could not read existing options") || [];

            for (let i = 0; i < remoteVariables.length; i += 1) {
                const remoteVariable = remoteVariables[i];
                const localVariableId = variableIdBySrc[remoteVariable.id];
                if (!localVariableId) continue;

                const optionEntries = Object.entries(remoteVariable.values?.values || {});

                for (let optionIndex = 0; optionIndex < optionEntries.length; optionIndex += 1) {
                    const [remoteOptionId, remoteOptionData] = optionEntries[optionIndex];
                    const optionLabel = typeof remoteOptionData === "object"
                        ? remoteOptionData.label
                        : String(remoteOptionData || remoteOptionId);

                    const existing = existingOptions.find(
                        (option) => option.variable_id === localVariableId && option.src_id === remoteOptionId
                    );

                    const payload = {
                        variable_id: localVariableId,
                        name: optionLabel || remoteOptionId,
                        sort_order: optionIndex + 1,
                        src_id: remoteOptionId
                    };

                    if (existing) {
                        const updateRes = await supabase
                            .from("options")
                            .update(payload)
                            .eq("id", existing.id);

                        if (updateRes.error) {
                            throw updateRes.error;
                        }
                    } else {
                        const insertRes = await supabase
                            .from("options")
                            .insert(payload);

                        if (insertRes.error) {
                            throw insertRes.error;
                        }
                    }
                }
            }

            if (Object.keys(levelIdBySrc).length > 0) {
                showToast("Hack synced. Categories, levels, variables and options updated.", "success");
            } else {
                showToast("Hack synced. Categories and variables updated.", "success");
            }

            await loadModeratorData();
        } catch (syncError) {
            showToast(syncError.message || "Could not sync hack.", "error", 5000);
        } finally {
            setSyncingHack(false);
        }
    };

    if (!ready) {
        return <section className="card"><p>Loading moderator panel...</p></section>;
    }

    if (!user || !isModerator) {
        return (
            <section className="card">
                <h2>Access denied</h2>
                <p>You must be logged in as moderator to view this page.</p>
                <p><Link to="/">Back to Home</Link></p>
            </section>
        );
    }

    return (
        <section className="page-moderator">
            <div className="card">
                <h2>Pending Runs</h2>
                {loading && <p>Loading...</p>}
                {error && <p className="error-text">{error}</p>}
                {!loading && pendingRuns.length === 0 && <p>No pending runs.</p>}

                {!loading && pendingRuns.length > 0 && (
                    <div className="run-list">
                        {pendingRuns.map((run) => (
                            <div key={run.id} className="run-item run-item-actions">
                                <div>
                                    <strong>{run.playerName}</strong>
                                    <span>{run.hackName} - {run.categoryName}</span>
                                    <span>{formatTime(run.timeInMs)} | {formatDate(run.dateAchieved)}</span>
                                </div>
                                <div className="row-actions">
                                    <button type="button" className="btn btn-success" onClick={() => moderateRun(run, "approved")}>Approve</button>
                                    <button type="button" className="btn btn-warning" onClick={() => moderateRun(run, "rejected")}>Reject</button>
                                    <button type="button" className="btn btn-danger" onClick={() => deleteRun(run)}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="card">
                <h2>Manage All Runs</h2>

                <div className="form-grid three-col">
                    <label>
                        Search
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Player, hack, category"
                        />
                    </label>

                    <label>
                        Status
                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                            <option value="all">All</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="obsolete">Obsolete</option>
                        </select>
                    </label>
                </div>

                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Hack</th>
                                <th>Category</th>
                                <th>Time</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRuns.map((run) => (
                                <tr key={run.id}>
                                    <td>{run.playerName}</td>
                                    <td>{hacksById[run.hack_id]?.name || run.hackName}</td>
                                    <td>{run.categoryName}</td>
                                    <td>{formatTime(run.timeInMs)}</td>
                                    <td><span className={`status ${run.status}`}>{run.status}</span></td>
                                    <td>
                                        <div className="row-actions">
                                            <button type="button" className="btn btn-success btn-sm" onClick={() => moderateRun(run, "approved")}>Approve</button>
                                            <button type="button" className="btn btn-warning btn-sm" onClick={() => moderateRun(run, "rejected")}>Reject</button>
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => moderateRun(run, "obsolete")}>Obsolete</button>
                                            <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteRun(run)}>Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!loading && filteredRuns.length === 0 && (
                                <tr>
                                    <td colSpan={6}>No runs found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="card">
                <h2>Manage Hacks</h2>

                {hacks.length === 0 && <p>No hacks found yet.</p>}

                {hacks.length > 0 && (
                    <>
                        <form className="form" onSubmit={saveHackChanges}>
                            <div className="form-grid three-col">
                                <label>
                                    Select Hack
                                    <select value={selectedHackId} onChange={(event) => setSelectedHackId(event.target.value)}>
                                        {hacks.map((hack) => (
                                            <option key={hack.id} value={hack.id}>{hack.name}</option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    Hack Name
                                    <input
                                        type="text"
                                        value={editHackName}
                                        onChange={(event) => setEditHackName(event.target.value)}
                                        required
                                    />
                                </label>

                                <label>
                                    Slug
                                    <input
                                        type="text"
                                        value={editHackSlug}
                                        onChange={(event) => setEditHackSlug(event.target.value)}
                                        required
                                    />
                                </label>
                            </div>

                            <div className="form-grid three-col">
                                <label>
                                    Release Year
                                    <input
                                        type="number"
                                        value={editHackYear}
                                        onChange={(event) => setEditHackYear(event.target.value)}
                                    />
                                </label>

                                <label>
                                    Release Date
                                    <input
                                        type="date"
                                        value={editHackReleaseDate}
                                        onChange={(event) => setEditHackReleaseDate(event.target.value)}
                                    />
                                </label>

                                <label>
                                    Cover URL
                                    <input
                                        type="url"
                                        value={editHackImage}
                                        onChange={(event) => setEditHackImage(event.target.value)}
                                        placeholder="https://..."
                                    />
                                </label>
                            </div>

                            <div className="form-grid three-col">
                                <label>
                                    Speedrun Game ID
                                    <input
                                        type="text"
                                        value={editHackSrcId}
                                        onChange={(event) => setEditHackSrcId(event.target.value)}
                                        placeholder="example: o1y9wo6q"
                                    />
                                </label>
                            </div>

                            <div className="row-actions">
                                <button type="submit" className="btn btn-primary" disabled={hackEditorDisabled}>
                                    {savingHack ? "Saving..." : "Save Hack"}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setEditHackSlug(slugify(editHackName))}
                                    disabled={hackEditorDisabled}
                                >
                                    Regenerate Slug
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-warning"
                                    onClick={syncHackFromSpeedrun}
                                    disabled={hackEditorDisabled}
                                >
                                    {syncingHack ? "Syncing..." : "Sync from speedrun.com"}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={deleteHack}
                                    disabled={hackEditorDisabled}
                                >
                                    Delete Hack
                                </button>
                            </div>
                        </form>

                        <h3>Hack Data Editor</h3>
                        <p>Edit categories, levels, variables, options and stars for the selected hack.</p>
                        {loadingHackData && <p>Loading hack data...</p>}

                        {!loadingHackData && selectedHack && (
                            <>
                                <h4>Categories</h4>
                                <div className="table-wrap">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Type</th>
                                                <th>Order</th>
                                                <th>SRC ID</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortByOrder(hackCategories).map((category) => (
                                                <tr key={category.id}>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={category.name || ""}
                                                            onChange={(event) => updateCategoryDraft(category.id, "name", event.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <select
                                                            value={category.type || "fullgame"}
                                                            onChange={(event) => updateCategoryDraft(category.id, "type", event.target.value)}
                                                        >
                                                            {CATEGORY_TYPE_OPTIONS.map((typeOption) => (
                                                                <option key={typeOption.value} value={typeOption.value}>{typeOption.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            value={category.order ?? ""}
                                                            onChange={(event) => updateCategoryDraft(category.id, "order", event.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={category.srcId || ""}
                                                            onChange={(event) => updateCategoryDraft(category.id, "srcId", event.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div className="row-actions">
                                                            <button type="button" className="btn btn-primary btn-sm" onClick={() => saveCategory(category)} disabled={hackEditorDisabled}>Save</button>
                                                            <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteCategory(category)} disabled={hackEditorDisabled}>Delete</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {hackCategories.length === 0 && (
                                                <tr>
                                                    <td colSpan={5}>No categories yet.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="form-grid three-col">
                                    <label>
                                        New Category Name
                                        <input type="text" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} />
                                    </label>
                                    <label>
                                        Type
                                        <select value={newCategoryType} onChange={(event) => setNewCategoryType(event.target.value)}>
                                            {CATEGORY_TYPE_OPTIONS.map((typeOption) => (
                                                <option key={typeOption.value} value={typeOption.value}>{typeOption.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Order
                                        <input type="number" value={newCategoryOrder} onChange={(event) => setNewCategoryOrder(event.target.value)} />
                                    </label>
                                    <label>
                                        SRC ID
                                        <input type="text" value={newCategorySrcId} onChange={(event) => setNewCategorySrcId(event.target.value)} />
                                    </label>
                                </div>
                                <div className="row-actions">
                                    <button type="button" className="btn btn-primary btn-sm" onClick={addCategory} disabled={hackEditorDisabled}>Add Category</button>
                                </div>

                                <h4>Levels</h4>
                                <div className="table-wrap">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Order</th>
                                                <th>SRC ID</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortByOrder(hackLevels).map((level) => (
                                                <tr key={level.id}>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={level.name || ""}
                                                            onChange={(event) => updateLevelDraft(level.id, "name", event.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            value={level.order ?? ""}
                                                            onChange={(event) => updateLevelDraft(level.id, "order", event.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={level.srcId || ""}
                                                            onChange={(event) => updateLevelDraft(level.id, "srcId", event.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div className="row-actions">
                                                            <button type="button" className="btn btn-primary btn-sm" onClick={() => saveLevel(level)} disabled={hackEditorDisabled}>Save</button>
                                                            <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteLevel(level)} disabled={hackEditorDisabled}>Delete</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {hackLevels.length === 0 && (
                                                <tr>
                                                    <td colSpan={4}>No levels yet.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="form-grid three-col">
                                    <label>
                                        New Level Name
                                        <input type="text" value={newLevelName} onChange={(event) => setNewLevelName(event.target.value)} />
                                    </label>
                                    <label>
                                        Order
                                        <input type="number" value={newLevelOrder} onChange={(event) => setNewLevelOrder(event.target.value)} />
                                    </label>
                                    <label>
                                        SRC ID
                                        <input type="text" value={newLevelSrcId} onChange={(event) => setNewLevelSrcId(event.target.value)} />
                                    </label>
                                </div>
                                <div className="row-actions">
                                    <button type="button" className="btn btn-primary btn-sm" onClick={addLevel} disabled={hackEditorDisabled}>Add Level</button>
                                </div>

                                <h4>Variables</h4>
                                <div className="table-wrap">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Category</th>
                                                <th>Order</th>
                                                <th>SRC ID</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortByOrder(hackVariables).map((variable) => (
                                                <tr key={variable.id}>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={variable.name || ""}
                                                            onChange={(event) => updateVariableDraft(variable.id, "name", event.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <select
                                                            value={variable.category_id || ""}
                                                            onChange={(event) => updateVariableDraft(variable.id, "category_id", event.target.value)}
                                                        >
                                                            <option value="">No category</option>
                                                            {hackCategories.map((category) => (
                                                                <option key={category.id} value={category.id}>{category.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            value={variable.order ?? ""}
                                                            onChange={(event) => updateVariableDraft(variable.id, "order", event.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={variable.srcId || ""}
                                                            onChange={(event) => updateVariableDraft(variable.id, "srcId", event.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div className="row-actions">
                                                            <button type="button" className="btn btn-primary btn-sm" onClick={() => saveVariable(variable)} disabled={hackEditorDisabled}>Save</button>
                                                            <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteVariable(variable)} disabled={hackEditorDisabled}>Delete</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {hackVariables.length === 0 && (
                                                <tr>
                                                    <td colSpan={5}>No variables yet.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="form-grid three-col">
                                    <label>
                                        New Variable Name
                                        <input type="text" value={newVariableName} onChange={(event) => setNewVariableName(event.target.value)} />
                                    </label>
                                    <label>
                                        Category
                                        <select value={newVariableCategoryId} onChange={(event) => setNewVariableCategoryId(event.target.value)}>
                                            <option value="">No category</option>
                                            {hackCategories.map((category) => (
                                                <option key={category.id} value={category.id}>{category.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Order
                                        <input type="number" value={newVariableOrder} onChange={(event) => setNewVariableOrder(event.target.value)} />
                                    </label>
                                    <label>
                                        SRC ID
                                        <input type="text" value={newVariableSrcId} onChange={(event) => setNewVariableSrcId(event.target.value)} />
                                    </label>
                                </div>
                                <div className="row-actions">
                                    <button type="button" className="btn btn-primary btn-sm" onClick={addVariable} disabled={hackEditorDisabled}>Add Variable</button>
                                </div>

                                <h4>Options</h4>
                                <div className="table-wrap">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Variable</th>
                                                <th>Order</th>
                                                <th>SRC ID</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortByOrder(hackOptions).map((option) => (
                                                <tr key={option.id}>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={option.name || ""}
                                                            onChange={(event) => updateOptionDraft(option.id, "name", event.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <select
                                                            value={option.variable_id || ""}
                                                            onChange={(event) => updateOptionDraft(option.id, "variable_id", event.target.value)}
                                                        >
                                                            <option value="">Select variable</option>
                                                            {hackVariables.map((variable) => (
                                                                <option key={variable.id} value={variable.id}>{variable.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            value={option.order ?? ""}
                                                            onChange={(event) => updateOptionDraft(option.id, "order", event.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={option.srcId || ""}
                                                            onChange={(event) => updateOptionDraft(option.id, "srcId", event.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div className="row-actions">
                                                            <button type="button" className="btn btn-primary btn-sm" onClick={() => saveOption(option)} disabled={hackEditorDisabled}>Save</button>
                                                            <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteOption(option)} disabled={hackEditorDisabled}>Delete</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {hackOptions.length === 0 && (
                                                <tr>
                                                    <td colSpan={5}>No options yet.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="form-grid three-col">
                                    <label>
                                        New Option Name
                                        <input type="text" value={newOptionName} onChange={(event) => setNewOptionName(event.target.value)} />
                                    </label>
                                    <label>
                                        Variable
                                        <select value={newOptionVariableId} onChange={(event) => setNewOptionVariableId(event.target.value)}>
                                            <option value="">Select variable</option>
                                            {hackVariables.map((variable) => (
                                                <option key={variable.id} value={variable.id}>{variable.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Order
                                        <input type="number" value={newOptionOrder} onChange={(event) => setNewOptionOrder(event.target.value)} />
                                    </label>
                                    <label>
                                        SRC ID
                                        <input type="text" value={newOptionSrcId} onChange={(event) => setNewOptionSrcId(event.target.value)} />
                                    </label>
                                </div>
                                <div className="row-actions">
                                    <button type="button" className="btn btn-primary btn-sm" onClick={addOption} disabled={hackEditorDisabled}>Add Option</button>
                                </div>

                                <h4>Stars</h4>
                                <div className="table-wrap">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Level</th>
                                                <th>Order</th>
                                                <th>SRC ID</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortByOrder(hackStars).map((star) => (
                                                <tr key={star.id}>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={star.name || ""}
                                                            onChange={(event) => updateStarDraft(star.id, "name", event.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <select
                                                            value={star.level_id || ""}
                                                            onChange={(event) => updateStarDraft(star.id, "level_id", event.target.value)}
                                                        >
                                                            <option value="">Select level</option>
                                                            {hackLevels.map((level) => (
                                                                <option key={level.id} value={level.id}>{level.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            value={star.order ?? ""}
                                                            onChange={(event) => updateStarDraft(star.id, "order", event.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={star.srcId || ""}
                                                            onChange={(event) => updateStarDraft(star.id, "srcId", event.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div className="row-actions">
                                                            <button type="button" className="btn btn-primary btn-sm" onClick={() => saveStar(star)} disabled={hackEditorDisabled}>Save</button>
                                                            <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteStar(star)} disabled={hackEditorDisabled}>Delete</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {hackStars.length === 0 && (
                                                <tr>
                                                    <td colSpan={5}>No stars yet.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="form-grid three-col">
                                    <label>
                                        New Star Name
                                        <input type="text" value={newStarName} onChange={(event) => setNewStarName(event.target.value)} />
                                    </label>
                                    <label>
                                        Level
                                        <select value={newStarLevelId} onChange={(event) => setNewStarLevelId(event.target.value)}>
                                            <option value="">Select level</option>
                                            {hackLevels.map((level) => (
                                                <option key={level.id} value={level.id}>{level.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Order
                                        <input type="number" value={newStarOrder} onChange={(event) => setNewStarOrder(event.target.value)} />
                                    </label>
                                    <label>
                                        SRC ID
                                        <input type="text" value={newStarSrcId} onChange={(event) => setNewStarSrcId(event.target.value)} />
                                    </label>
                                </div>
                                <div className="row-actions">
                                    <button type="button" className="btn btn-primary btn-sm" onClick={addStar} disabled={hackEditorDisabled}>Add Star</button>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>

            <div className="card">
                <h2>Add New Hack</h2>
                <form className="form" onSubmit={addHack}>
                    <div className="form-grid three-col">
                        <label>
                            Hack Name
                            <input
                                type="text"
                                value={newHackName}
                                onChange={(event) => setNewHackName(event.target.value)}
                                required
                            />
                        </label>

                        <label>
                            Release Year
                            <input
                                type="number"
                                value={newHackYear}
                                onChange={(event) => setNewHackYear(event.target.value)}
                            />
                        </label>

                        <label>
                            Cover URL
                            <input
                                type="url"
                                value={newHackImage}
                                onChange={(event) => setNewHackImage(event.target.value)}
                                placeholder="https://..."
                            />
                        </label>
                    </div>

                    <div className="form-grid three-col">
                        <label>
                            Speedrun Game ID (optional)
                            <input
                                type="text"
                                value={newHackSrcId}
                                onChange={(event) => setNewHackSrcId(event.target.value)}
                                placeholder="example: o1y9wo6q"
                            />
                        </label>
                    </div>

                    <button type="submit" className="btn btn-primary">Create Hack</button>
                </form>
            </div>
        </section>
    );
}
