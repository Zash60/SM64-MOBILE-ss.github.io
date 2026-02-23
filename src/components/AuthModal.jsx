import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

import Modal from "./Modal";

const INITIAL_FORM = {
    username: "",
    email: "",
    password: ""
};

export default function AuthModal({ mode, open, onClose }) {
    const { login, register } = useAuth();
    const { showToast } = useToast();

    const [form, setForm] = useState(INITIAL_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const isLogin = mode === "login";

    const title = useMemo(() => (isLogin ? "Login" : "Register"), [isLogin]);

    useEffect(() => {
        if (open) {
            setForm(INITIAL_FORM);
            setSubmitting(false);
            setError("");
        }
    }, [open, mode]);

    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            setSubmitting(true);
            setError("");

            if (isLogin) {
                await login(form.email.trim(), form.password);
                showToast("Login successful.", "success");
            } else {
                const result = await register(form.username.trim(), form.email.trim(), form.password);
                if (result.session) {
                    showToast("Account created and logged in.", "success");
                } else {
                    showToast("Account created. Confirm your email if required.", "info", 5000);
                }
            }

            onClose();
        } catch (submitError) {
            setError(submitError.message || "Authentication failed.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title={title}>
            <form className="form" onSubmit={handleSubmit}>
                {!isLogin && (
                    <label>
                        Username
                        <input
                            type="text"
                            value={form.username}
                            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                            required
                        />
                    </label>
                )}

                <label>
                    Email
                    <input
                        type="email"
                        value={form.email}
                        onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                        required
                    />
                </label>

                <label>
                    Password
                    <input
                        type="password"
                        value={form.password}
                        onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                        required
                    />
                </label>

                {error && <p className="error-text">{error}</p>}

                <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? "Please wait..." : title}
                </button>
            </form>
        </Modal>
    );
}
