import { useEffect } from "react";
import { useUIStore } from "../state/uiStore";

export default function Notification() {
  const notification = useUIStore((s) => s.notification);
  const hideNotification = useUIStore((s) => s.hideNotification);

  const { message, type, isVisible, duration } = notification;
  const autoClose = true; // Always auto-close

  useEffect(() => {
    if (isVisible && autoClose) {
      const timer = setTimeout(() => {
        hideNotification();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, autoClose, duration, hideNotification]);

  if (!isVisible) return null;

  const getTypeStyles = () => {
    switch (type) {
      case "error":
        return "bg-theme-notification-error-bg border-theme-notification-error-border text-theme-notification-error-text";
      case "warning":
        return "bg-theme-notification-warning-bg border-theme-notification-warning-border text-theme-notification-warning-text";
      case "success":
        return "bg-theme-notification-success-bg border-theme-notification-success-border text-theme-notification-success-text";
      case "info":
        return "bg-theme-notification-info-bg border-theme-notification-info-border text-theme-notification-info-text";
      default:
        return "bg-theme-surface-elevated border-theme-border-primary text-theme-text-primary";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      case "success":
        return "✅";
      case "info":
        return "ℹ️";
      default:
        return "📝";
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>

      <div
        className={`border rounded-lg p-4 shadow-lg ${getTypeStyles()} animate-slide-in`}
      >
        <div className="flex items-start gap-3">
          <span className="text-lg flex-shrink-0">{getIcon()}</span>
          <div className="flex-1">
            <p className="text-sm font-medium leading-relaxed">{message}</p>
          </div>
          <button
            onClick={hideNotification}
            className="flex-shrink-0 text-theme-text-tertiary hover:text-theme-text-secondary transition-colors"
            aria-label="Close notification"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
