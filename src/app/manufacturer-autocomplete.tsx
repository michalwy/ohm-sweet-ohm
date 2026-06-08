"use client";

import { LabelWithError, getFieldInputClassName } from "@/app/dialog-shell";
import { ComboboxBase } from "@/app/combobox-base";

export type ManufacturerSuggestion = { id: string; name: string };

type ManufacturerAutocompleteProps = {
  compact?: boolean;
  disabled: boolean;
  error?: string;
  inputId: string;
  label: string;
  name: string;
  noMatchingLabel: string;
  placeholder: string;
  suggestions: ManufacturerSuggestion[];
  value: string;
  onValueChange: (value: string) => void;
};

export function ManufacturerAutocomplete({
  compact = false,
  disabled,
  error,
  inputId,
  label,
  name,
  noMatchingLabel,
  placeholder,
  suggestions,
  value,
  onValueChange,
}: ManufacturerAutocompleteProps) {
  const matchingSuggestions = getManufacturerMatches(value, suggestions);

  const inputClassName = getFieldInputClassName(
    `rounded-md border border-slate-300 bg-white px-3 text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${
      compact ? "min-h-9 py-1.5 text-sm" : "min-h-11 py-2 text-base"
    }`,
    Boolean(error)
  );

  return (
    <div className={`relative grid text-sm font-medium text-slate-700 ${compact ? "min-w-52 gap-1.5" : "gap-2"}`}>
      <LabelWithError htmlFor={inputId} error={error}>
        {label}
      </LabelWithError>
      <ComboboxBase
        inputId={inputId}
        inputValue={value}
        placeholder={placeholder}
        disabled={disabled}
        inputName={name}
        inputClassName={inputClassName}
        inputAriaInvalid={Boolean(error)}
        items={matchingSuggestions}
        noItemsLabel={noMatchingLabel}
        positionMode="absolute"
        renderItem={(suggestion, isActive) => (
          <div
            className={`min-h-9 w-full rounded-md px-3 py-1.5 text-left text-sm transition ${
              isActive
                ? "bg-[var(--color-accent-soft)] font-semibold text-slate-950"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {suggestion.name}
          </div>
        )}
        onInputChange={onValueChange}
        onItemSelect={(suggestion) => onValueChange(suggestion.name)}
      />
    </div>
  );
}

function getManufacturerMatches(query: string, suggestions: ManufacturerSuggestion[]) {
  const normalizedQuery = normalizeManufacturerSearchText(query);

  return suggestions
    .map((suggestion) => ({
      suggestion,
      score: scoreManufacturerMatch(normalizedQuery, suggestion.name)
    }))
    .filter((match) => match.score >= 0)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      return left.suggestion.name.localeCompare(right.suggestion.name, "en", { sensitivity: "base" });
    })
    .slice(0, 6)
    .map((match) => match.suggestion);
}

function scoreManufacturerMatch(query: string, manufacturerName: string) {
  const normalizedName = normalizeManufacturerSearchText(manufacturerName);

  if (!query) return 1;
  if (normalizedName === query) return 100;
  if (normalizedName.startsWith(query)) return 80 - normalizedName.length / 100;
  if (normalizedName.includes(query)) return 60 - normalizedName.indexOf(query);

  let queryIndex = 0;
  let score = 30;

  for (let nameIndex = 0; nameIndex < normalizedName.length; nameIndex += 1) {
    if (normalizedName[nameIndex] !== query[queryIndex]) continue;
    queryIndex += 1;
    score -= nameIndex / 100;
    if (queryIndex === query.length) return score;
  }

  return -1;
}

function normalizeManufacturerSearchText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}
