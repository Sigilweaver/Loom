import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "./Button";

export interface PaginationProps {
  /** Zero-based current page. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Noun for the count, e.g. "executions". */
  noun?: string;
}

/** "Showing 1-20 of 84" plus previous/next. Renders nothing for a single page. */
export function Pagination({ page, pageSize, total, onPageChange, noun = "items" }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const first = page * pageSize + 1;
  const last = Math.min((page + 1) * pageSize, total);

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-ink-subtle">
        Showing {first}-{last} of {total} {noun}
      </p>
      <div className="flex items-center gap-1">
        <IconButton
          label="Previous page"
          disabled={page === 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </IconButton>
        <span className="px-2 text-sm text-ink-muted">
          Page {page + 1} of {totalPages}
        </span>
        <IconButton
          label="Next page"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </IconButton>
      </div>
    </nav>
  );
}
