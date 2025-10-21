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
import { ConfigValidationMessage } from "./ConfigValidationMessage";
import { usePrimitiveEmission } from "./hooks";

export interface ConfigSelectOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  keywords?: string[];
}

export interface ConfigSelectProps {
  value: string | undefined;
  onChange: (
    value: string | undefined,
    emitPatch: EmissionMap,
    shouldEmit: boolean
  ) => void;
  configKey: string;
  options: ConfigSelectOption[];
  label?: ReactNode;
  description?: ReactNode;
  inlineMessage?: ReactNode;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyOptionLabel?: string;
  className?: string;
  selectClassName?: string;
  onSearchChange?: (term: string) => void;
  noOptionsMessage?: ReactNode;
  searchNoMatchMessage?: ReactNode;
}

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

export const ConfigSelect: React.FC<ConfigSelectProps> = ({
  value,
  onChange,
  configKey,
  options,
  label = "Select option",
  description,
  inlineMessage,
  defaultValue = "",
  disabled = false,
  required = false,
  placeholder = "Choose an option",
  searchable = false,
  searchPlaceholder = "Search options...",
  emptyOptionLabel = "Use default",
  className,
  onSearchChange,
  noOptionsMessage = "No options available.",
  searchNoMatchMessage = "No options match your search.",
}) => {
  const selectId = useId();
  const descriptionId = description ? `${selectId}-description` : undefined;
  const listboxId = `${selectId}-listbox`;
  const searchId = `${selectId}-search`;

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { shouldEmit, commit } = usePrimitiveEmission<string>({
    configKey,
    value,
    defaultValue,
    onChange,
  });

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchTouched, setSearchTouched] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const term = event.target.value;
      setSearchTerm(term);
      if (term.length > 0) {
        setSearchTouched(true);
      }
      onSearchChange?.(term);
    },
    [onSearchChange]
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

  const defaultOption = useMemo(
    () => options.find((option) => option.value === defaultValue) ?? null,
    [options, defaultValue]
  );

  const effectiveValue = value ?? defaultOption?.value ?? undefined;

  const resolvedOptions = useMemo(() => {
    const baseList = [...filteredOptions];
    if (effectiveValue !== undefined) {
      const hasSelected = baseList.some(
        (option) => option.value === effectiveValue
      );
      if (!hasSelected) {
        const current = options.find(
          (option) => option.value === effectiveValue
        );
        if (current) {
          baseList.unshift(current);
        }
      }
    }
    return baseList;
  }, [filteredOptions, options, effectiveValue]);

  const includePlaceholder = !required && searchTerm.trim().length === 0;

  const listOptions = useMemo(() => {
    const entries: Array<ConfigSelectOption & { synthetic?: boolean }> = [];
    if (includePlaceholder) {
      entries.push({
        value: "",
        label: placeholder ?? emptyOptionLabel,
        synthetic: true,
      });
    }
    for (const option of resolvedOptions) {
      entries.push(option);
    }
    return entries;
  }, [resolvedOptions, includePlaceholder, placeholder, emptyOptionLabel]);

  const actionableOptions = useMemo(
    () => listOptions.filter((option) => !option.disabled),
    [listOptions]
  );

  const matchableOptions = useMemo(
    () => listOptions.filter((option) => !option.disabled && !option.synthetic),
    [listOptions]
  );

  const showSearchNoMatchMessage =
    searchable &&
    searchTouched &&
    searchTerm.trim().length > 0 &&
    matchableOptions.length === 0;
  const showBaseEmptyMessage = options.length === 0;
  const validationMessage = showSearchNoMatchMessage
    ? searchNoMatchMessage
    : showBaseEmptyMessage
      ? noOptionsMessage
      : null;

  const selectedOption = useMemo(() => {
    if (effectiveValue === undefined) {
      return null;
    }
    return options.find((option) => option.value === effectiveValue) ?? null;
  }, [options, effectiveValue]);

  const resetSearchState = useCallback(() => {
    setSearchTerm("");
    setSearchTouched(false);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    resetSearchState();
    setActiveIndex(null);
    triggerRef.current?.focus();
  }, [resetSearchState]);

  const openPanel = useCallback(() => {
    if (disabled) {
      return;
    }
    setIsOpen(true);
  }, [disabled]);

  const commitSelection = useCallback(
    (optionValue: string | undefined) => {
      commit(optionValue);
      closePanel();
    },
    [closePanel, commit]
  );

  const handleTriggerClick = useCallback(() => {
    if (disabled) {
      return;
    }
    setIsOpen((prev) => {
      const next = !prev;
      if (!next) {
        resetSearchState();
        setActiveIndex(null);
      }
      return next;
    });
  }, [disabled, resetSearchState]);

  const handleTriggerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) {
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!isOpen) {
          openPanel();
        }
        setActiveIndex((current) => {
          if (current != null) {
            return current;
          }
          if (actionableOptions.length === 0) {
            return null;
          }
          const initial = actionableOptions[0]!;
          const index = listOptions.indexOf(initial);
          return index >= 0 ? index : null;
        });
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    },
    [disabled, actionableOptions, listOptions, isOpen, openPanel]
  );

  const findNextEnabled = useCallback(
    (startIndex: number, direction: 1 | -1): number | null => {
      const total = listOptions.length;
      let index = startIndex;
      while (index >= 0 && index < total) {
        const option = listOptions[index];
        if (option && !option.disabled) {
          return index;
        }
        index += direction;
      }
      return null;
    },
    [listOptions]
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
            return findNextEnabled(listOptions.length - 1, -1);
          }
          const next = findNextEnabled(current - 1, -1);
          return next ?? current;
        });
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (activeIndex == null) {
          return;
        }
        const option = listOptions[activeIndex];
        if (!option || option.disabled) {
          return;
        }
        const optionValue = option.synthetic ? undefined : option.value;
        commitSelection(optionValue);
      }
    },
    [activeIndex, listOptions, commitSelection, findNextEnabled, closePanel]
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

    const valueToMatch = effectiveValue;
    if (valueToMatch !== undefined) {
      const index = listOptions.findIndex(
        (option) => !option.synthetic && option.value === valueToMatch
      );
      if (index >= 0) {
        setActiveIndex(index);
        return;
      }
    }

    const placeholderIndex = listOptions.findIndex(
      (option) => option.synthetic
    );
    if (placeholderIndex >= 0) {
      setActiveIndex(placeholderIndex);
      return;
    }

    const firstEnabled = findNextEnabled(0, 1);
    setActiveIndex(firstEnabled ?? null);
  }, [isOpen, listOptions, searchable, effectiveValue, findNextEnabled]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (listRef.current && activeIndex != null) {
      const optionId = `${selectId}-option-${activeIndex}`;
      const activeEl = document.getElementById(optionId);
      if (activeEl && typeof activeEl.scrollIntoView === "function") {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex, isOpen, selectId]);

  const handleOptionSelect = useCallback(
    (option: ConfigSelectOption & { synthetic?: boolean }) => {
      if (option.disabled) {
        return;
      }
      const optionValue = option.synthetic ? undefined : option.value;
      commitSelection(optionValue);
    },
    [commitSelection]
  );

  const handleOptionMouseEnter = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const handleSearchInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      handleSearchChange(event);
      if (event.target.value.length === 0) {
        setActiveIndex((current) => {
          if (current != null) {
            return current;
          }
          return findNextEnabled(0, 1);
        });
      }
    },
    [handleSearchChange, findNextEnabled]
  );

  const hasInteractiveOptions =
    matchableOptions.length > 0 || (value !== undefined && !required);

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

  const triggerLabel = selectedOption ? (
    <span className="truncate text-theme-text-primary">
      {selectedOption.label}
    </span>
  ) : (
    <span className="truncate text-theme-text-tertiary">
      {placeholder ?? emptyOptionLabel}
    </span>
  );

  const listHasVisibleOptions = listOptions.length > 0;
  const placeholderSelected = value === undefined && !defaultOption;

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
            "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
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
          disabled={disabled || !hasInteractiveOptions}
        >
          {triggerLabel}
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
                  onChange={handleSearchInput}
                  placeholder={searchPlaceholder}
                  className="w-full px-2 py-1 text-sm bg-transparent border rounded border-theme-border-primary text-theme-text-primary placeholder-theme-text-tertiary focus:outline-none focus:ring-1 focus:ring-theme-border-focus"
                  aria-label="Filter options"
                />
              </div>
            )}

            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
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
              {listHasVisibleOptions ? (
                listOptions.map((option, index) => {
                  const isSelected = option.synthetic
                    ? placeholderSelected
                    : option.value === effectiveValue;
                  const isActive = index === activeIndex;
                  return (
                    <li
                      key={`${option.value}-${index}`}
                      id={`${selectId}-option-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      className={clsx(
                        "cursor-pointer px-3 py-2",
                        isActive ? "bg-theme-surface-hover" : "bg-transparent",
                        option.disabled && "cursor-not-allowed opacity-50",
                        !option.disabled && "hover:bg-theme-surface-hover"
                      )}
                      onMouseEnter={() => handleOptionMouseEnter(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleOptionSelect(option)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium truncate">
                          {option.label}
                        </span>
                        {isSelected && (
                          <span className="text-xs text-theme-interactive-accent">
                            Selected
                          </span>
                        )}
                      </div>
                      {option.description && (
                        <div className="mt-1 text-xs text-theme-text-tertiary">
                          {option.description}
                        </div>
                      )}
                    </li>
                  );
                })
              ) : (
                <li className="px-3 py-4 text-sm text-theme-text-tertiary">
                  {searchable && searchTerm.trim().length > 0
                    ? searchNoMatchMessage
                    : noOptionsMessage}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <ConfigValidationMessage
        id={`${selectId}-validation`}
        state="info"
        message={validationMessage}
      />
    </ConfigField>
  );
};
