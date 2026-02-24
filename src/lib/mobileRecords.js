import { COURSES, getCourseById, getStarName } from "../data/courses";
import { hasSupabase, supabase } from "./supabase";
import { formatTime, parseTimeToMilliseconds, unwrap } from "./utils";

export const MOBILE_HACK_SLUG = "sm64-mobile-records";
export const MOBILE_HACK_NAME = "SM64 Mobile Records";
export const MOBILE_CATEGORY_NAME = "Star Runs";

export function getRunIgt(run) {
    const raw = String(run?.variables?.igt || "").trim();
    return raw || formatTime(run.timeInMs);
}

export function getRunRta(run) {
    const raw = String(run?.variables?.rta || "").trim();
    return raw || "-";
}

export function getRunCourseId(run) {
    return String(run?.variables?.courseId || "").trim();
}

export function getRunStarIndex(run) {
    const starIndex = Number(run?.variables?.starIndex || 0);
    return Number.isFinite(starIndex) && starIndex > 0 ? starIndex : 0;
}

export function getRunStarName(run) {
    const starName = String(run?.variables?.starName || "").trim();
    if (starName) return starName;

    const courseId = getRunCourseId(run);
    const starIndex = getRunStarIndex(run);
    return getStarName(courseId, starIndex);
}

export function getRunDateTimestamp(run) {
    const source = run.submittedAt || run.dateAchieved || "";
    const timestamp = new Date(source).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getComparableRunId(run) {
    return String(run?.id || "");
}

function isEarlierRun(left, right) {
    const leftTimestamp = getRunDateTimestamp(left);
    const rightTimestamp = getRunDateTimestamp(right);

    if (leftTimestamp !== rightTimestamp) {
        return leftTimestamp < rightTimestamp;
    }

    return getComparableRunId(left) < getComparableRunId(right);
}

function formatDateWithLeadingZero(source) {
    const date = new Date(source);
    if (Number.isNaN(date.getTime())) return "-";
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
}

export function formatRunDateLabel(run) {
    return formatDateWithLeadingZero(run?.dateAchieved || run?.submittedAt || "");
}

export function matchesStar(run, courseId, starIndex) {
    return getRunCourseId(run) === courseId && getRunStarIndex(run) === Number(starIndex);
}

export function normalizeRta(value) {
    const trimmed = String(value || "").trim();
    return trimmed || "-";
}

export function parseIgtToMs(igtInput) {
    let input = String(igtInput || "").trim();
    if (!input) {
        throw new Error("Invalid IGT format.");
    }

    input = input
        .replace(/[’′]/g, "'")
        .replace(/[”″]/g, "\"")
        .replace(/\s+/g, "");

    if (input.includes("'") || input.includes("\"")) {
        input = input.replace(/'/g, ":").replace(/"/g, ".").replace(/:\./g, ".");
    }

    const ms = parseTimeToMilliseconds(input);
    if (Number.isNaN(ms) || ms < 0) {
        throw new Error("Invalid IGT format.");
    }
    return ms;
}

function parseFreeTimeToMs(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw || raw === "-") return Number.NaN;
    return parseIgtToMs(raw);
}

function formatDiff(oldTimeMs, newTimeMs) {
    const diffMs = Math.abs(oldTimeMs - newTimeMs);
    if (Number.isNaN(diffMs)) return "00\"00";

    const totalCentiseconds = Math.round(diffMs / 10);
    const secondsTotal = Math.floor(totalCentiseconds / 100);
    const centiseconds = totalCentiseconds % 100;

    if (secondsTotal >= 60) {
        const minutes = Math.floor(secondsTotal / 60);
        const seconds = secondsTotal % 60;
        return `${minutes}'${String(seconds).padStart(2, "0")}"${String(centiseconds).padStart(2, "0")}`;
    }

    return `${String(secondsTotal).padStart(2, "0")}"${String(centiseconds).padStart(2, "0")}`;
}

function daysBetweenRuns(leftRun, rightRun) {
    const left = new Date(leftRun?.dateAchieved || leftRun?.submittedAt || "").getTime();
    const right = new Date(rightRun?.dateAchieved || rightRun?.submittedAt || "").getTime();

    if (Number.isNaN(left) || Number.isNaN(right)) return 0;
    return Math.ceil(Math.abs(left - right) / 86400000);
}

export function getVideoEmbedUrl(videoUrl) {
    const url = String(videoUrl || "").trim();
    if (!url) return "";

    const ytPattern = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const ytMatch = url.match(ytPattern);
    if (ytMatch?.[2]?.length === 11) {
        return `https://www.youtube.com/embed/${ytMatch[2]}`;
    }

    const biliMatch = url.match(/(BV[a-zA-Z0-9]+)/);
    if (biliMatch?.[1]) {
        return `https://player.bilibili.com/player.html?bvid=${biliMatch[1]}&page=1&high_quality=1&danmaku=0`;
    }

    return "";
}

export function getTimelineTag(currentRun, allRuns) {
    const courseId = getRunCourseId(currentRun);
    const starIndex = getRunStarIndex(currentRun);

    const previousRuns = allRuns.filter((candidate) => {
        if (candidate.id === currentRun.id) return false;
        if (!matchesStar(candidate, courseId, starIndex)) return false;
        return isEarlierRun(candidate, currentRun);
    });

    if (previousRuns.length === 0) {
        return "[New]";
    }

    previousRuns.sort((left, right) => left.timeInMs - right.timeInMs);
    const bestPreviousIGT = previousRuns[0];
    const bestCurrent = currentRun.timeInMs < bestPreviousIGT.timeInMs;

    const currentRtaMs = parseFreeTimeToMs(getRunRta(currentRun));
    const previousWithRta = previousRuns
        .filter((run) => getRunRta(run) !== "-")
        .map((run) => ({ ...run, rtaMs: parseFreeTimeToMs(getRunRta(run)) }))
        .filter((run) => !Number.isNaN(run.rtaMs))
        .sort((left, right) => left.rtaMs - right.rtaMs);

    const bestPreviousRta = previousWithRta[0];
    let bestRta = false;

    if (!Number.isNaN(currentRtaMs) && currentRtaMs >= 0) {
        if (!bestPreviousRta) {
            bestRta = true;
        } else {
            bestRta = currentRtaMs < bestPreviousRta.rtaMs;
        }
    }

    if (bestCurrent && bestRta) return "[RT / IGT]";
    if (bestRta) return "[RT]";
    if (bestCurrent) return "[IGT]";
    return "[Run]";
}

export function buildTimelineNarrative(currentRun, allRuns) {
    const courseId = getRunCourseId(currentRun);
    const starIndex = getRunStarIndex(currentRun);

    const previousRuns = allRuns.filter((candidate) => {
        if (candidate.id === currentRun.id) return false;
        if (!matchesStar(candidate, courseId, starIndex)) return false;
        return isEarlierRun(candidate, currentRun);
    });

    const currentIgtText = getRunIgt(currentRun);
    const currentIgtMs = currentRun.timeInMs;
    const currentRtaText = getRunRta(currentRun);
    const currentRtaMs = parseFreeTimeToMs(currentRtaText);

    if (previousRuns.length === 0) {
        return {
            tag: "[New]",
            main: `${currentRun.playerName} set the first record with ${currentIgtText} (RT: ${currentRtaText})!`,
            details: []
        };
    }

    const sortedByIgt = [...previousRuns].sort((left, right) => left.timeInMs - right.timeInMs);
    const prevBestIgt = sortedByIgt[0];
    const beatIgt = currentIgtMs < prevBestIgt.timeInMs;
    const igtDiff = beatIgt ? formatDiff(prevBestIgt.timeInMs, currentIgtMs) : "00\"00";

    const previousWithRta = previousRuns
        .map((run) => ({ run, rtaMs: parseFreeTimeToMs(getRunRta(run)) }))
        .filter((item) => !Number.isNaN(item.rtaMs))
        .sort((left, right) => left.rtaMs - right.rtaMs);

    const prevBestRtaItem = previousWithRta[0] || null;
    const beatRta = !Number.isNaN(currentRtaMs)
        && (prevBestRtaItem ? currentRtaMs < prevBestRtaItem.rtaMs : true);
    const rtDiff = beatRta && prevBestRtaItem
        ? formatDiff(prevBestRtaItem.rtaMs, currentRtaMs)
        : "00\"00";

    let tag = "[Run]";
    if (beatRta && beatIgt) tag = "[RT / IGT]";
    else if (beatRta) tag = "[RT]";
    else if (beatIgt) tag = "[IGT]";

    let main = `${currentRun.playerName} completed this star in ${currentIgtText} (RT: ${currentRtaText}).`;
    if (beatRta && beatIgt) {
        main = `${currentRun.playerName} beat the real time record and the best IGT with a ${currentRtaText} (-${rtDiff}) and ${currentIgtText} (-${igtDiff})!`;
    } else if (beatRta) {
        main = `${currentRun.playerName} beat the real time record with a ${currentRtaText} (-${rtDiff})!`;
    } else if (beatIgt) {
        main = `${currentRun.playerName} beat the best IGT with a ${currentIgtText} (-${igtDiff})!`;
    }

    const details = [];
    if (beatRta && prevBestRtaItem) {
        details.push(
            `The previous real time record was ${getRunRta(prevBestRtaItem.run)} by ${prevBestRtaItem.run.playerName}. (Achieved: ${daysBetweenRuns(currentRun, prevBestRtaItem.run)} days ago)`
        );
    }
    if (beatIgt) {
        details.push(
            `The previous best IGT was ${getRunIgt(prevBestIgt)} by ${prevBestIgt.playerName}. (Achieved: ${daysBetweenRuns(currentRun, prevBestIgt)} days ago)`
        );
    }

    return { tag, main, details };
}

export function buildRunPayload({ setup, playerName, courseId, starIndex, igt, rta, dateAchieved, videoUrl, userId, approveNow = false }) {
    if (!setup?.hack?.id || !setup?.category?.id) {
        throw new Error("Site setup not found. Ask a moderator to initialize this site.");
    }

    const course = getCourseById(courseId);
    if (!course) {
        throw new Error("Course is required.");
    }

    const starName = getStarName(courseId, starIndex);
    if (!starName) {
        throw new Error("Star is required.");
    }

    const cleanPlayer = String(playerName || "").trim();
    if (!cleanPlayer) {
        throw new Error("Player name is required.");
    }

    const cleanIgt = String(igt || "").trim();
    if (!cleanIgt) {
        throw new Error("IGT is required.");
    }

    const timeInMs = parseIgtToMs(cleanIgt);
    const cleanRta = normalizeRta(rta);
    const cleanVideo = String(videoUrl || "").trim();
    const cleanDate = String(dateAchieved || "").trim();

    return {
        hack_id: setup.hack.id,
        category_id: setup.category.id,
        hack_slug: setup.hack.slug,
        hack_name: setup.hack.name,
        category_name: setup.category.name,
        player_name: cleanPlayer,
        user_id: userId || "anonymous",
        time_in_ms: timeInMs,
        date_achieved: cleanDate || null,
        video_url: cleanVideo || null,
        status: approveNow ? "approved" : "pending",
        variables: {
            courseId,
            courseName: course.name,
            starIndex: Number(starIndex),
            starName,
            igt: cleanIgt,
            rta: cleanRta
        }
    };
}

export async function loadMobileSetup() {
    if (!hasSupabase || !supabase) {
        throw new Error("Supabase is not configured.");
    }

    const hackRes = await supabase
        .from("hacks")
        .select("*")
        .eq("slug", MOBILE_HACK_SLUG)
        .maybeSingle();

    const hack = unwrap(hackRes, "Failed to load mobile hack");
    if (!hack) {
        return {
            hack: null,
            category: null,
            levels: [],
            stars: []
        };
    }

    const [categoriesRes, levelsRes, starsRes] = await Promise.all([
        supabase
            .from("categories")
            .select("*")
            .eq("hack_id", hack.id)
            .order("sort_order", { ascending: true }),
        supabase
            .from("levels")
            .select("*")
            .eq("hack_id", hack.id)
            .order("sort_order", { ascending: true }),
        supabase
            .from("stars")
            .select("*")
            .eq("hack_id", hack.id)
            .order("sort_order", { ascending: true })
    ]);

    const categories = unwrap(categoriesRes, "Failed to load categories") || [];
    const levels = unwrap(levelsRes, "Failed to load levels") || [];
    const stars = unwrap(starsRes, "Failed to load stars") || [];

    const category = categories.find((item) => item.name === MOBILE_CATEGORY_NAME)
        || categories[0]
        || null;

    return {
        hack,
        category,
        levels,
        stars
    };
}

export async function bootstrapMobileSetup() {
    if (!hasSupabase || !supabase) {
        throw new Error("Supabase is not configured.");
    }

    const existingHackRes = await supabase
        .from("hacks")
        .select("*")
        .eq("slug", MOBILE_HACK_SLUG)
        .maybeSingle();

    let hack = unwrap(existingHackRes, "Failed to read hack") || null;

    if (!hack) {
        const insertHackRes = await supabase
            .from("hacks")
            .insert({
                name: MOBILE_HACK_NAME,
                slug: MOBILE_HACK_SLUG,
                year: 2026
            })
            .select("*")
            .single();

        hack = unwrap(insertHackRes, "Failed to create hack");
    }

    const categoriesRes = await supabase
        .from("categories")
        .select("*")
        .eq("hack_id", hack.id)
        .order("sort_order", { ascending: true });

    const categories = unwrap(categoriesRes, "Failed to read categories") || [];
    let category = categories.find((item) => item.name === MOBILE_CATEGORY_NAME) || null;

    if (!category) {
        const insertCategoryRes = await supabase
            .from("categories")
            .insert({
                hack_id: hack.id,
                name: MOBILE_CATEGORY_NAME,
                type: "fullgame",
                sort_order: 1
            })
            .select("*")
            .single();

        category = unwrap(insertCategoryRes, "Failed to create category");
    }

    const levelsRes = await supabase
        .from("levels")
        .select("id, src_id")
        .eq("hack_id", hack.id);

    const existingLevels = unwrap(levelsRes, "Failed to read levels") || [];
    const levelIdByCourseId = {};

    for (let index = 0; index < COURSES.length; index += 1) {
        const course = COURSES[index];
        const existingLevel = existingLevels.find((level) => level.src_id === course.id);

        if (existingLevel) {
            const updateLevelRes = await supabase
                .from("levels")
                .update({
                    name: course.name,
                    sort_order: index + 1
                })
                .eq("id", existingLevel.id);

            if (updateLevelRes.error) {
                throw updateLevelRes.error;
            }

            levelIdByCourseId[course.id] = existingLevel.id;
        } else {
            const insertLevelRes = await supabase
                .from("levels")
                .insert({
                    hack_id: hack.id,
                    name: course.name,
                    sort_order: index + 1,
                    src_id: course.id
                })
                .select("id")
                .single();

            const insertedLevel = unwrap(insertLevelRes, "Failed to create level");
            levelIdByCourseId[course.id] = insertedLevel.id;
        }
    }

    const starsRes = await supabase
        .from("stars")
        .select("id, src_id")
        .eq("hack_id", hack.id);

    const existingStars = unwrap(starsRes, "Failed to read stars") || [];

    for (let courseIndex = 0; courseIndex < COURSES.length; courseIndex += 1) {
        const course = COURSES[courseIndex];
        const levelId = levelIdByCourseId[course.id];
        if (!levelId) continue;

        for (let starIndex = 0; starIndex < course.stars.length; starIndex += 1) {
            const starName = course.stars[starIndex];
            const srcId = `${course.id}:${starIndex + 1}`;
            const existingStar = existingStars.find((star) => star.src_id === srcId);

            if (existingStar) {
                const updateStarRes = await supabase
                    .from("stars")
                    .update({
                        name: starName,
                        sort_order: starIndex + 1,
                        level_id: levelId
                    })
                    .eq("id", existingStar.id);

                if (updateStarRes.error) {
                    throw updateStarRes.error;
                }
            } else {
                const insertStarRes = await supabase
                    .from("stars")
                    .insert({
                        hack_id: hack.id,
                        level_id: levelId,
                        name: starName,
                        sort_order: starIndex + 1,
                        src_id: srcId
                    });

                if (insertStarRes.error) {
                    throw insertStarRes.error;
                }
            }
        }
    }

    return {
        hack,
        category
    };
}
