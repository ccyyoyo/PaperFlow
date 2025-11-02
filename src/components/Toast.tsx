/**
 * 檔案說明：
 * 簡易 Toast 呈現容器，負責從狀態讀取訊息並顯示。
 */
import { useToast } from "../state/useToast";
import "./toast.css";

/**
 * ToastContainer 元件：顯示目前佇列中的提示訊息，點擊可移除。
 */
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
