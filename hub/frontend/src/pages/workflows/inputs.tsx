import { useId, useRef, useState, type KeyboardEvent } from "react";
import clsx from "clsx";
import { Folder, X } from "lucide-react";
import { Input, fieldSurface } from "@components/ui";

interface FolderInputProps {
  id?: string;
  value: string;
  onChange: (path: string) => void;
  existingFolders: string[];
}

/** Folder path input that suggests the folders already in use. */
export function FolderInput({ id, value, onChange, existingFolders }: FolderInputProps) {
  const listId = useId();
  const folders = ["/", ...existingFolders.filter((f) => f !== "/")].sort();

  return (
    <div className="relative">
      <Folder className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        placeholder="/"
        className="pl-9"
        autoComplete="off"
      />
      <datalist id={listId}>
        {folders.map((folder) => (
          <option key={folder} value={folder} />
        ))}
      </datalist>
    </div>
  );
}

interface TagInputProps {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  placeholder?: string;
  invalid?: boolean;
  "aria-describedby"?: string;
}

/** Tag chips with a text box. Enter or comma adds a tag; Backspace removes the last one. */
export function TagInput({ id, value, onChange, suggestions, placeholder, invalid, ...rest }: TagInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const add = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setText("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(text);
    } else if (event.key === "Backspace" && !text && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div
      className={clsx(
        fieldSurface(invalid),
        "flex min-h-9 w-full flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/40"
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full border border-accent-line bg-accent-soft py-0.5 pr-1 pl-2.5 text-xs font-medium text-accent-ink"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="rounded-full p-0.5 hover:bg-accent-line"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        {...rest}
        id={id}
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        // Commit half-typed text so submitting the form does not lose it.
        onBlur={() => add(text)}
        list={listId}
        autoComplete="off"
        placeholder={value.length === 0 ? placeholder : ""}
        className="min-w-24 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !value.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}
