import { useEffect, useMemo, useState } from "react";

import { COURSES } from "../data/courses";
import { getRunCourseId, getRunIgt, getRunRta, getRunStarIndex, getRunVersion } from "../lib/mobileRecords";
import Modal from "./Modal";

const EMPTY_FORM = {
    courseId: COURSES[0]?.id || "",
    starIndex: "1",
    playerName: "",
    igt: "",
    rta: "",
    version: "1.0",
    dateAchieved: "",
    videoUrl: ""
};

export default function EditRunModal({ open, onClose, run, onSubmit, saving = false }) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState("");

    const selectedCourse = useMemo(
        () => COURSES.find((course) => course.id === form.courseId) || COURSES[0] || null,
        [form.courseId]
    );

    useEffect(() => {
        if (!open || !run) return;

        setError("");
        setForm({
            courseId: getRunCourseId(run) || COURSES[0]?.id || "",
            starIndex: String(getRunStarIndex(run) || 1),
            playerName: run.playerName || "",
            igt: getRunIgt(run) || "",
            rta: getRunRta(run) === "-" ? "" : getRunRta(run),
            version: getRunVersion(run) || "1.0",
            dateAchieved: run.dateAchieved || "",
            videoUrl: run.videoUrl || ""
        });
    }, [open, run]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!run) return;
        setError("");

        try {
            await onSubmit(run, {
                ...form,
                starIndex: Number(form.starIndex)
            });
            onClose();
        } catch (submitError) {
            setError(submitError.message || "Could not save run.");
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="Edit Run">
            <form className="form" onSubmit={handleSubmit}>
                <label>
                    Course
                    <select
                        value={form.courseId}
                        onChange={(event) => setForm((prev) => ({
                            ...prev,
                            courseId: event.target.value,
                            starIndex: "1"
                        }))}
                        required
                    >
                        {COURSES.map((course) => (
                            <option key={course.id} value={course.id}>{course.name}</option>
                        ))}
                    </select>
                </label>

                <label>
                    Star
                    <select
                        value={form.starIndex}
                        onChange={(event) => setForm((prev) => ({ ...prev, starIndex: event.target.value }))}
                        required
                    >
                        {(selectedCourse?.stars || []).map((star, index) => (
                            <option key={star} value={String(index + 1)}>{star}</option>
                        ))}
                    </select>
                </label>

                <label>
                    Player Name
                    <input
                        type="text"
                        value={form.playerName}
                        onChange={(event) => setForm((prev) => ({ ...prev, playerName: event.target.value }))}
                        required
                    />
                </label>

                <div className="form-grid two-col">
                    <label>
                        IGT
                        <input
                            type="text"
                            value={form.igt}
                            onChange={(event) => setForm((prev) => ({ ...prev, igt: event.target.value }))}
                            required
                        />
                    </label>

                    <label>
                        RT
                        <input
                            type="text"
                            value={form.rta}
                            onChange={(event) => setForm((prev) => ({ ...prev, rta: event.target.value }))}
                        />
                    </label>
                </div>

                <label>
                    Version
                    <input
                        type="text"
                        value={form.version}
                        onChange={(event) => setForm((prev) => ({ ...prev, version: event.target.value }))}
                        required
                    />
                </label>

                <label>
                    Date
                    <input
                        type="date"
                        value={form.dateAchieved}
                        onChange={(event) => setForm((prev) => ({ ...prev, dateAchieved: event.target.value }))}
                        required
                    />
                </label>

                <label>
                    Video Link
                    <input
                        type="url"
                        value={form.videoUrl}
                        onChange={(event) => setForm((prev) => ({ ...prev, videoUrl: event.target.value }))}
                        required
                    />
                </label>

                {error && <p className="error-text">{error}</p>}

                <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? "Saving..." : "Update Run"}
                </button>
            </form>
        </Modal>
    );
}
