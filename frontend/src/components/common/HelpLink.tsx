interface HelpLinkProps {
  url: string;
  label?: string;
  className?: string;
}

/**
 * A help link component that opens documentation in the default browser.
 * Renders a "?" icon that links to the provided URL.
 */
export function HelpLink({ url, label = "Help", className = "" }: HelpLinkProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full 
        text-theme-text-tertiary hover:text-theme-text-primary 
        hover:bg-theme-surface-elevated transition-colors ${className}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </a>
  );
}
