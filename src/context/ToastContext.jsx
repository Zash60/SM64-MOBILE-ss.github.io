import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const dismissToast = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const showToast = useCallback((message, type = "info", timeout = 3200) => {
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        window.setTimeout(() => dismissToast(id), timeout);
    }, [dismissToast]);

    const value = useMemo(() => ({ showToast, dismissToast }), [dismissToast, showToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="toast-stack" aria-live="polite" aria-atomic="true">
                {toasts.map((toast) => (
                    <button
                        key={toast.id}
                        type="button"
                        className={`toast-item ${toast.type}`}
                        onClick={() => dismissToast(toast.id)}
                        title="Dismiss"
                    >
                        {toast.message}
                    </button>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within ToastProvider");
    }
    return context;
}
