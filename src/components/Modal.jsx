import { useEffect } from "react";

export default function Modal({ open, onClose, title, children, wide = false }) {
    useEffect(() => {
        if (!open) return undefined;

        const onKeyDown = (event) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="modal-overlay active" onMouseDown={onClose}>
            <div className={`modal-panel ${wide ? "wide" : ""}`} onMouseDown={(event) => event.stopPropagation()}>
                <div className="modal-head">
                    <h3>{title}</h3>
                    <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
                        x
                    </button>
                </div>
                <div className="modal-body">{children}</div>
            </div>
        </div>
    );
}
