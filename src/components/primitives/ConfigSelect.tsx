import { XMLEmissionMap } from "@domain/workflow/entities/workflow";
import clsx from "clsx";
import React, {
  ChangeEvent,
  ReactNode,
  useCallback,
  useId,
  useMemo,
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
    emitPatch: XMLEmissionMap,
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
  selectClassName,
  onSearchChange,
  noOptionsMessage = "No options available.",
  searchNoMatchMessage = "No options match your search.",
}) => {
  const selectId = useId();
  const descriptionId = description ? `${selectId}-description` : undefined;
  const searchId = `${selectId}-search`;

  const { shouldEmit, commit } = usePrimitiveEmission<string>({
    configKey,
    value,
    defaultValue,
    onChange,
  });

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchTouched, setSearchTouched] = useState(false);

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

  const resolvedOptions = useMemo(() => {
    if (!value) {
      return filteredOptions;
    }

    const hasSelected = filteredOptions.some(
      (option) => option.value === value
    );
    if (hasSelected) {
      return filteredOptions;
    }

    const current = options.find((option) => option.value === value);
    if (!current) {
      return filteredOptions;
    }

    return [
      current,
      ...filteredOptions.filter((option) => option.value !== value),
    ];
  }, [filteredOptions, options, value]);

  const handleSelectChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextValue = event.target.value;
      const candidate = nextValue.length > 0 ? nextValue : undefined;
      commit(candidate);
    },
    [commit]
  );

  const showEmptyOption = !required;
  const selectionValue = value ?? "";
  const hasMatches = resolvedOptions.length > 0;
  const showSearchNoMatchMessage =
    searchable && searchTouched && searchTerm.trim().length > 0 && !hasMatches;
  const showBaseEmptyMessage = options.length === 0;
  const validationMessage = showSearchNoMatchMessage
    ? searchNoMatchMessage
    : showBaseEmptyMessage
      ? noOptionsMessage
      : null;

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
      {searchable && (
        <input
          id={searchId}
          type="search"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder={searchPlaceholder}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border rounded-md border-theme-border-primary bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Filter options"
        />
      )}

      <select
        id={selectId}
        value={selectionValue}
        onChange={handleSelectChange}
        disabled={disabled || !hasMatches}
        aria-describedby={descriptionId}
        required={required}
        className={clsx(
          "w-full px-3 py-2 text-sm border rounded-md border-theme-border-primary bg-theme-surface-elevated text-theme-text-primary focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus disabled:opacity-50 disabled:cursor-not-allowed",
          selectClassName
        )}
      >
        {showEmptyOption && (
          <option value="" disabled={required}>
            {placeholder ?? emptyOptionLabel}
          </option>
        )}
        {resolvedOptions.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            title={
              typeof option.description === "string"
                ? option.description
                : undefined
            }
          >
            {option.label}
          </option>
        ))}
      </select>

      <ConfigValidationMessage state="info" message={validationMessage} />
    </ConfigField>
  );
};
