export function normalizeString(value) {
    if (value === null || value === undefined) return "";
    return String(value);
}

export function escapeHtml(value) {
    return normalizeString(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function safeUrl(value) {
    const raw = normalizeString(value).trim();
    if (!raw) return "";

    try {
        const parsed = new URL(raw, window.location.origin);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            return parsed.href;
        }
    } catch (_error) {
        return "";
    }

    return "";
}

export function slugify(text) {
    return normalizeString(text)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]+/g, "")
        .replace(/--+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "");
}

export function parseTimeToMilliseconds(timeStr) {
    const input = normalizeString(timeStr).trim();
    if (!input) return Number.NaN;

    let t = 0;
    if (input.includes(":")) {
        const parts = input.split(":").reverse();
        t += parseFloat(parts[0] || 0) * 1000;
        t += parseInt(parts[1] || 0, 10) * 60000;
        t += parseInt(parts[2] || 0, 10) * 3600000;
    } else {
        const hours = input.match(/(\d+)\s*h/);
        const minutes = input.match(/(\d+)\s*m/);
        const seconds = input.match(/(\d+(\.\d+)?)\s*s/);
        const ms = input.match(/(\d+)\s*ms/);

        if (hours?.[1]) t += parseInt(hours[1], 10) * 3600000;
        if (minutes?.[1]) t += parseInt(minutes[1], 10) * 60000;
        if (seconds?.[1]) t += parseFloat(seconds[1].replace(",", ".")) * 1000;
        if (ms?.[1]) t += parseInt(ms[1], 10);
    }

    if (t === 0 && !Number.isNaN(parseFloat(input))) {
        t = parseFloat(input) * 1000;
    }

    return Math.round(t);
}

export function formatTime(ms) {
    if (Number.isNaN(ms) || ms < 0) return "Invalid Time";

    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const mmm = ms % 1000;

    const pM = String(m).padStart(2, "0");
    const pS = String(s).padStart(2, "0");
    const pMMM = String(mmm).padStart(3, "0");

    if (h > 0) {
        return `${h}:${pM}:${pS}.${pMMM}`;
    }

    return `${m}:${pS}.${pMMM}`;
}

export function formatDate(dateLike) {
    if (!dateLike) return "-";
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return normalizeString(dateLike);
    return d.toLocaleDateString();
}

const ALLOWED_STATUSES = new Set(["pending", "approved", "rejected", "obsolete"]);

export function mapHackRow(row) {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        year: row.year,
        imageUrl: row.image_url,
        releaseDate: row.release_date,
        srcId: row.src_id
    };
}

export function mapCategoryRow(row) {
    return {
        id: row.id,
        name: row.name,
        type: row.type,
        order: row.sort_order,
        hack_id: row.hack_id,
        srcId: row.src_id
    };
}

export function mapLevelRow(row) {
    return {
        id: row.id,
        name: row.name,
        order: row.sort_order,
        hack_id: row.hack_id,
        srcId: row.src_id
    };
}

export function mapVariableRow(row) {
    return {
        id: row.id,
        name: row.name,
        order: row.sort_order,
        hack_id: row.hack_id,
        category_id: row.category_id,
        srcId: row.src_id
    };
}

export function mapOptionRow(row) {
    return {
        id: row.id,
        name: row.name,
        order: row.sort_order,
        variable_id: row.variable_id,
        srcId: row.src_id
    };
}

export function mapStarRow(row) {
    return {
        id: row.id,
        name: row.name,
        order: row.sort_order,
        level_id: row.level_id,
        hack_id: row.hack_id,
        srcId: row.src_id
    };
}

export function mapRunRow(row) {
    const status = ALLOWED_STATUSES.has(row.status) ? row.status : "pending";
    return {
        id: row.id,
        hack_id: row.hack_id,
        hack_slug: row.hack_slug,
        category_id: row.category_id,
        hackName: row.hack_name,
        categoryName: row.category_name,
        playerName: row.player_name,
        userId: row.user_id,
        timeInMs: row.time_in_ms,
        dateAchieved: row.date_achieved || "",
        videoUrl: row.video_url || "",
        variables: row.variables || {},
        status,
        pb_key: row.pb_key,
        submittedAt: row.submitted_at
    };
}

export function toRunRow(run) {
    return {
        id: run.id,
        hack_id: run.hack_id,
        hack_slug: run.hack_slug,
        category_id: run.category_id,
        hack_name: run.hackName,
        category_name: run.categoryName,
        player_name: run.playerName,
        user_id: run.userId,
        time_in_ms: run.timeInMs,
        date_achieved: run.dateAchieved || null,
        video_url: run.videoUrl || null,
        variables: run.variables || {},
        status: run.status,
        pb_key: run.pb_key || null,
        submitted_at: run.submittedAt || new Date().toISOString()
    };
}

export function generatePBKey(run) {
    const sortedVars = Object.keys(run.variables || {})
        .sort()
        .map((key) => `${key}=${run.variables[key]}`)
        .join("&");

    return `${run.userId}_${run.category_id}_${sortedVars}`;
}

export function generateCompareKeyWithoutUser(run) {
    const sortedVars = Object.keys(run.variables || {})
        .sort()
        .map((key) => `${key}=${run.variables[key]}`)
        .join("&");

    return `${run.category_id}_${sortedVars}`;
}

export function unwrap(result, context) {
    if (result.error) {
        throw new Error(`${context}: ${result.error.message}`);
    }
    return result.data;
}

export function getTypeLabel(type) {
    if (type === "fullgame") return "Full Game";
    if (type === "level_rta") return "Level RTA";
    if (type === "level_singlestar") return "Single Star";
    return type;
}
