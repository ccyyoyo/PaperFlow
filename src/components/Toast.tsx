import { useToast } from "../state/useToast";
import "./toast.css";

export function ToastContainer() {
  const items = useToast((s) => s.items);
  const remove = useToast((s) => s.remove);
  if (items.length === 0) return null;
  return (
    <div className="toast-container">
      {items.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.kind}`}
          onClick={() => remove(t.id)}
          role="status"
          aria-live="polite"
        >
          <span className="toast__dot" />
          <span className="toast__text">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

