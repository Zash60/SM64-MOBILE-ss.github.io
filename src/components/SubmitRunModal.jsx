import { useEffect, useMemo, useState } from "react";

import { COURSES } from "../data/courses";
import Modal from "./Modal";

const INITIAL_FORM = {
    courseId: COURSES[0]?.id || "",
    starIndex: "1",
    playerName: "",
    igt: "",
    rta: "",
    version: "1.0",
    dateAchieved: "",
    videoUrl: ""
};

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

export default function SubmitRunModal({ open, onClose, onSubmit, submitting = false, submitLabel = "Submit Run" }) {
    const [form, setForm] = useState({
        ...INITIAL_FORM,
        dateAchieved: todayIso()
    });
    const [error, setError] = useState("");

    const selectedCourse = useMemo(
        () => COURSES.find((course) => course.id === form.courseId) || COURSES[0] || null,
        [form.courseId]
    );

    useEffect(() => {
        if (!open) return;
        setError("");
        setForm({
            ...INITIAL_FORM,
            courseId: COURSES[0]?.id || "",
            starIndex: "1",
            dateAchieved: todayIso()
        });
    }, [open]);

    useEffect(() => {
        if (!selectedCourse) return;

        const maxStars = selectedCourse.stars.length;
        const current = Number(form.starIndex || 0);
        if (current >= 1 && current <= maxStars) return;

        setForm((prev) => ({
            ...prev,
            starIndex: "1"
        }));
    }, [form.starIndex, selectedCourse]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");

        try {
            await onSubmit({ ...form, starIndex: Number(form.starIndex) });
            onClose();
        } catch (submitError) {
            setError(submitError.message || "Could not submit run.");
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="Submit New Run">
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
                            placeholder="1:18.23"
                            required
                        />
                    </label>

                    <label>
                        RT (Optional)
                        <input
                            type="text"
                            value={form.rta}
                            onChange={(event) => setForm((prev) => ({ ...prev, rta: event.target.value }))}
                            placeholder="1:22.10"
                        />
                    </label>
                </div>

                <label>
                    Version
                    <input
                        type="text"
                        value={form.version}
                        onChange={(event) => setForm((prev) => ({ ...prev, version: event.target.value }))}
                        placeholder="1.0"
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
                        placeholder="https://www.youtube.com/watch?v=..."
                        required
                    />
                </label>

                {error && <p className="error-text">{error}</p>}

                <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? "Sending..." : submitLabel}
                </button>
            </form>
        </Modal>
    );
}
