import { EmissionMap } from "@domain/workflow/entities/workflow";
import clsx from "clsx";
import React, {
  ChangeEvent,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { ConfigField } from "./ConfigField";
import { ConfigSelectOption } from "./ConfigSelect";
import { ConfigValidationMessage } from "./ConfigValidationMessage";
import { usePrimitiveEmission } from "./hooks";

export interface ConfigMultiSelectProps {
  value: string[] | undefined;
  onChange: (
    value: string[] | undefined,
    emitPatch: EmissionMap,
    shouldEmit: boolean
  ) => void;
  configKey: string;
  options: ConfigSelectOption[];
  label?: ReactNode;
  description?: ReactNode;
  inlineMessage?: ReactNode;
  defaultValue?: string[];
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  allowReorder?: boolean;
  maxSelections?: number;
  className?: string;
  noOptionsMessage?: ReactNode;
  searchNoMatchMessage?: ReactNode;
  showSelectAll?: boolean;
  showClearAll?: boolean;
}

const EMPTY_ARRAY: readonly string[] = Object.freeze([]);

const buildOptionSearchText = (option: ConfigSelectOption): string => {
  const parts: string[] = [];
  parts.push(option.value);
  if (typeof option.label === "string") {
    parts.push(option.label);
  }
  if (typeof option.description === "string") {
    parts.push(option.description);
  }
  if (Array.isArray(option.keywords)) {
    parts.push(option.keywords.join(" "));
  }
  return parts.join(" ").toLowerCase();
};

export const ConfigMultiSelect: React.FC<ConfigMultiSelectProps> = ({
  value,
  onChange,
  configKey,
  options,
  label = "Select options",
  description,
  inlineMessage,
  defaultValue = EMPTY_ARRAY,
  disabled = false,
  required = false,
  placeholder = "Select items...",
  searchable = true,
  searchPlaceholder = "Search options...",
  allowReorder = false,
  maxSelections,
  className,
  noOptionsMessage = "No options available.",
  searchNoMatchMessage = "No options match your search.",
  showSelectAll = true,
  showClearAll = true,
}) => {
  const selectId = useId();
  const descriptionId = description ? `${selectId}-description` : undefined;
  const listboxId = `${selectId}-listbox`;
  const searchId = `${selectId}-search`;

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const normalizedValue = useMemo(
    () => (Array.isArray(value) && value.length > 0 ? value : undefined),
    [value]
  );

  const resolvedDefault = useMemo(
    () =>
      Array.isArray(defaultValue) && defaultValue.length > 0
        ? defaultValue
        : ([] as string[]),
    [defaultValue]
  );

  const { shouldEmit, commit } = usePrimitiveEmission<string[]>({
    configKey,
    value: normalizedValue,
    defaultValue: resolvedDefault,
    onChange,
  });

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const selectedValues = normalizedValue ?? EMPTY_ARRAY;

  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(event.target.value);
    },
    []
  );

  const optionSearchIndex = useMemo(() => {
    if (!searchable) {
      return new Map<string, string>();
    }
    const index = new Map<string, string>();
    for (const option of options) {
      index.set(option.value, buildOptionSearchText(option));
    }
    return index;
  }, [options, searchable]);

  const filteredOptions = useMemo(() => {
    if (!searchable) {
      return options;
    }

    const term = searchTerm.trim().toLowerCase();
    if (term.length === 0) {
      return options;
    }

    return options.filter((option) => {
      const indexValue = optionSearchIndex.get(option.value);
      if (!indexValue) {
        return false;
      }
      return indexValue.includes(term);
    });
  }, [options, searchable, optionSearchIndex, searchTerm]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    setSearchTerm("");
    setActiveIndex(null);
    triggerRef.current?.focus();
  }, []);

  const openPanel = useCallback(() => {
    if (disabled) {
      return;
    }
    setIsOpen(true);
  }, [disabled]);

  const toggleSelection = useCallback(
    (optionValue: string) => {
      if (disabled) return;

      const currentSelection = [...selectedValues];
      const index = currentSelection.indexOf(optionValue);

      if (index >= 0) {
        // Deselect
        currentSelection.splice(index, 1);
      } else {
        // Select
        if (maxSelections && currentSelection.length >= maxSelections) {
          return; // Max selections reached
        }
        currentSelection.push(optionValue);
      }

      const nextValue =
        currentSelection.length > 0 ? currentSelection : undefined;
      commit(nextValue);
    },
    [selectedValues, disabled, maxSelections, commit]
  );

  const handleSelectAll = useCallback(() => {
    if (disabled) return;

    const availableValues = filteredOptions
      .filter((opt) => !opt.disabled)
      .map((opt) => opt.value);

    if (maxSelections) {
      availableValues.splice(maxSelections);
    }

    commit(availableValues.length > 0 ? availableValues : undefined);
  }, [filteredOptions, disabled, maxSelections, commit]);

  const handleClearAll = useCallback(() => {
    if (disabled) return;
    commit(undefined);
  }, [disabled, commit]);

  const removeTag = useCallback(
    (optionValue: string, event: React.MouseEvent) => {
      event.stopPropagation();
      toggleSelection(optionValue);
    },
    [toggleSelection]
  );

  const moveTag = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!allowReorder || disabled) return;

      const newSelection = [...selectedValues];
      const [removed] = newSelection.splice(fromIndex, 1);
      if (removed !== undefined) {
        newSelection.splice(toIndex, 0, removed);
        commit(newSelection.length > 0 ? newSelection : undefined);
      }
    },
    [selectedValues, allowReorder, disabled, commit]
  );

  const handleTriggerClick = useCallback(() => {
    if (disabled) {
      return;
    }
    setIsOpen((prev) => !prev);
  }, [disabled]);

  const handleTriggerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!isOpen) {
          openPanel();
        }
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    },
    [disabled, isOpen, openPanel]
  );

  const findNextEnabled = useCallback(
    (startIndex: number, direction: 1 | -1): number | null => {
      const total = filteredOptions.length;
      let index = startIndex;
      while (index >= 0 && index < total) {
        const option = filteredOptions[index];
        if (option && !option.disabled) {
          return index;
        }
        index += direction;
      }
      return null;
    },
    [filteredOptions]
  );

  const handleListKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLUListElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => {
          if (current == null) {
            return findNextEnabled(0, 1);
          }
          const next = findNextEnabled(current + 1, 1);
          return next ?? current;
        });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => {
          if (current == null) {
            return findNextEnabled(filteredOptions.length - 1, -1);
          }
          const next = findNextEnabled(current - 1, -1);
          return next ?? current;
        });
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (activeIndex == null) {
          return;
        }
        const option = filteredOptions[activeIndex];
        if (!option || option.disabled) {
          return;
        }
        toggleSelection(option.value);
      }
    },
    [activeIndex, filteredOptions, toggleSelection, findNextEnabled, closePanel]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        closePanel();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, closePanel]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (searchable) {
      searchInputRef.current?.focus();
    } else {
      listRef.current?.focus();
    }

    const firstEnabled = findNextEnabled(0, 1);
    setActiveIndex(firstEnabled ?? null);
  }, [isOpen, searchable, findNextEnabled]);

  useEffect(() => {
    if (!isOpen || activeIndex == null) {
      return;
    }
    const optionId = `${selectId}-option-${activeIndex}`;
    const activeEl = document.getElementById(optionId);
    if (activeEl && typeof activeEl.scrollIntoView === "function") {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, isOpen, selectId]);

  const selectedOptions = useMemo(() => {
    return selectedValues
      .map((val) => options.find((opt) => opt.value === val))
      .filter((opt): opt is ConfigSelectOption => opt !== undefined);
  }, [selectedValues, options]);

  const showSearchNoMatchMessage =
    searchable && searchTerm.trim().length > 0 && filteredOptions.length === 0;
  const showBaseEmptyMessage = options.length === 0;
  const validationMessage = showSearchNoMatchMessage
    ? searchNoMatchMessage
    : showBaseEmptyMessage
      ? noOptionsMessage
      : null;

  const describedByIds = useMemo(() => {
    const ids: string[] = [];
    if (descriptionId) {
      ids.push(descriptionId);
    }
    if (validationMessage) {
      ids.push(`${selectId}-validation`);
    }
    return ids.length > 0 ? ids.join(" ") : undefined;
  }, [descriptionId, validationMessage, selectId]);

  const canSelectMore = !maxSelections || selectedValues.length < maxSelections;

  return (
    <ConfigField
      label={label}
      labelFor={selectId}
      description={description}
      descriptionId={descriptionId}
      inlineMessage={inlineMessage}
      willEmit={shouldEmit}
      required={required}
      className={className}
      contentClassName="space-y-2"
    >
      <div ref={containerRef} className="relative">
        <button
          id={selectId}
          ref={triggerRef}
          type="button"
          className={clsx(
            "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors min-h-[42px]",
            "border-theme-border-primary bg-theme-surface-elevated text-left",
            "focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-describedby={describedByIds}
          onClick={handleTriggerClick}
          onKeyDown={handleTriggerKeyDown}
          disabled={disabled}
        >
          {selectedValues.length === 0 ? (
            <span className="text-theme-text-tertiary">{placeholder}</span>
          ) : (
            <span className="text-theme-text-secondary">
              {selectedValues.length} selected
            </span>
          )}
          <span
            className={clsx(
              "ml-auto text-theme-text-tertiary transition-transform",
              isOpen && "rotate-180"
            )}
            aria-hidden
          >
            ▾
          </span>
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden border rounded-md shadow-xl border-theme-border-primary bg-theme-surface-panel">
            {searchable && (
              <div className="p-2 border-b border-theme-border-primary bg-theme-surface-elevated">
                <input
                  ref={searchInputRef}
                  id={searchId}
                  type="search"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder={searchPlaceholder}
                  className="w-full px-2 py-1 text-sm bg-transparent border rounded border-theme-border-primary text-theme-text-primary placeholder-theme-text-tertiary focus:outline-none focus:ring-1 focus:ring-theme-border-focus"
                  aria-label="Filter options"
                />
              </div>
            )}

            {(showSelectAll || showClearAll) && (
              <div className="flex gap-2 p-2 border-b border-theme-border-primary bg-theme-surface-elevated">
                {showSelectAll && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    disabled={disabled || !canSelectMore}
                    className="px-2 py-1 text-xs transition-colors border rounded border-theme-border-primary text-theme-text-secondary hover:bg-theme-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Select All
                  </button>
                )}
                {showClearAll && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={disabled || selectedValues.length === 0}
                    className="px-2 py-1 text-xs transition-colors border rounded border-theme-border-primary text-theme-text-secondary hover:bg-theme-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Clear All
                  </button>
                )}
              </div>
            )}

            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-multiselectable="true"
              tabIndex={-1}
              aria-activedescendant={
                activeIndex != null
                  ? `${selectId}-option-${activeIndex}`
                  : undefined
              }
              aria-labelledby={selectId}
              onKeyDown={handleListKeyDown}
              className="overflow-y-auto text-sm max-h-60 text-theme-text-primary focus:outline-none"
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => {
                  const isSelected = selectedValues.includes(option.value);
                  const isActive = index === activeIndex;
                  const isDisabled =
                    option.disabled || (!isSelected && !canSelectMore);

                  return (
                    <li
                      key={`${option.value}-${index}`}
                      id={`${selectId}-option-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      className={clsx(
                        "cursor-pointer px-3 py-2 flex items-center gap-2",
                        isActive ? "bg-theme-surface-hover" : "bg-transparent",
                        isDisabled && "cursor-not-allowed opacity-50",
                        !isDisabled && "hover:bg-theme-surface-hover"
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() =>
                        !isDisabled && toggleSelection(option.value)
                      }
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => {}}
                        className="h-4 w-4 text-theme-interactive-accent rounded border-theme-border-primary focus:ring-1 focus:ring-theme-border-focus"
                        tabIndex={-1}
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {option.label}
                        </div>
                        {option.description && (
                          <div className="mt-1 text-xs text-theme-text-tertiary">
                            {option.description}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })
              ) : (
                <li className="px-3 py-4 text-sm text-theme-text-tertiary">
                  {validationMessage}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Selected tags */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map((option, index) => (
            <div
              key={option.value}
              className={clsx(
                "flex items-center gap-1.5 px-2 py-1 text-xs rounded",
                "bg-theme-interactive-accent/10 border border-theme-interactive-accent/30",
                "text-theme-text-primary",
                allowReorder && "cursor-move"
              )}
              draggable={allowReorder && !disabled}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", index.toString());
              }}
              onDragOver={(e) => {
                if (allowReorder && !disabled) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(e) => {
                if (allowReorder && !disabled) {
                  e.preventDefault();
                  const fromIndex = parseInt(
                    e.dataTransfer.getData("text/plain"),
                    10
                  );
                  if (!isNaN(fromIndex) && fromIndex !== index) {
                    moveTag(fromIndex, index);
                  }
                }
              }}
            >
              {allowReorder && !disabled && (
                <span
                  className="text-theme-text-tertiary cursor-move"
                  aria-hidden
                >
                  ⋮⋮
                </span>
              )}
              <span className="font-medium">{option.label}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => removeTag(option.value, e)}
                  className="text-theme-text-tertiary hover:text-theme-text-primary transition-colors"
                  aria-label={`Remove ${option.label}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {maxSelections && (
        <div className="text-xs text-theme-text-tertiary">
          {selectedValues.length} / {maxSelections} selected
        </div>
      )}

      <ConfigValidationMessage
        id={`${selectId}-validation`}
        state="info"
        message={validationMessage}
      />
    </ConfigField>
  );
};
