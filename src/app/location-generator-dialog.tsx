"use client";

import { forwardRef, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  DialogActions,
  DialogBody,
  DialogSecondaryButton,
  DialogShell
} from "@/app/dialog-shell";
import {
  LocationTreeSelect,
  formLocationSelectButtonClassName,
  type LocationTreeItem
} from "@/app/location-tree-select";
import {
  LOCATION_GENERATOR_MAX_NEW,
  LOCATION_GENERATOR_MAX_PLANNED,
  normalizeLocationName,
  planLocationHierarchy,
  resolvePlannedLocations,
  validateLocationGeneratorLevels,
  type LocationCounterKind,
  type LocationGeneratorIssue,
  type LocationGeneratorLevel
} from "@/lib/locationGenerator";
import { generateLocationsForWorkspace } from "@/server/inventory/locationActions";
import type { StorageLocationListItem } from "@/server/inventory/locationMutations";

export type LocationGeneratorCopy = {
  title: string;
  description: string;
  generate: string;
  parentLocation: string;
  rootLocation: string;
  chooseParentLocation: string;
  searchLocations: string;
  noMatchingLocations: string;
  expandLocation: string;
  collapseLocation: string;
  close: string;
  levels: string;
  level: string;
  prefix: string;
  counter: string;
  numbers: string;
  letters: string;
  start: string;
  count: string;
  padding: string;
  paddingAuto: string;
  paddingNone: string;
  paddingDigits: string;
  suffix: string;
  type: string;
  assignable: string;
  organizational: string;
  addLevel: string;
  removeLevel: string;
  tokenHelp: string;
  preview: string;
  previewSummary: string;
  previewMore: string;
  exists: string;
  nothingNew: string;
  issueNoLevels: string;
  issueCount: string;
  issueStart: string;
  issuePadding: string;
  issueToken: string;
  issueTooManyPlanned: string;
  issueTooManyNew: string;
  errorTooManyNew: string;
  errorParentMissing: string;
  errorDuplicate: string;
  errorGeneric: string;
};

type LevelDraft = {
  prefix: string;
  suffix: string;
  counter: LocationCounterKind;
  start: string;
  count: string;
  padding: string;
  isAssignable: boolean;
  /** Whether the user picked this level's type; untouched levels follow the default. */
  typeChosen: boolean;
};

const PREVIEW_ROW_LIMIT = 300;
const PADDING_DIGIT_OPTIONS = [2, 3, 4, 5, 6];

export const LocationGeneratorDialog = forwardRef<
  HTMLDialogElement,
  {
    copy: LocationGeneratorCopy;
    formKey: number;
    locations: StorageLocationListItem[];
    locationTree: LocationTreeItem[];
    workspaceSlug: string;
    onGenerated: (result: {
      parentId: string | null;
      created: StorageLocationListItem[];
      reusedCount: number;
    }) => void;
  }
>(function LocationGeneratorDialog(
  { copy, formKey, locations, locationTree, workspaceSlug, onGenerated },
  ref
) {
  return (
    <DialogShell
      ref={ref}
      closeLabel={copy.close}
      description={copy.description}
      title={copy.title}
      titleId="location-generator-dialog-title"
      widthClassName="w-[min(72rem,calc(100vw-3rem))]"
      heightClassName="h-[min(48rem,calc(100vh-2rem))]"
    >
      <LocationGeneratorForm
        key={formKey}
        copy={copy}
        locations={locations}
        locationTree={locationTree}
        workspaceSlug={workspaceSlug}
        onGenerated={onGenerated}
      />
    </DialogShell>
  );
});

function LocationGeneratorForm({
  copy,
  locations,
  locationTree,
  workspaceSlug,
  onGenerated
}: {
  copy: LocationGeneratorCopy;
  locations: StorageLocationListItem[];
  locationTree: LocationTreeItem[];
  workspaceSlug: string;
  onGenerated: (result: {
    parentId: string | null;
    created: StorageLocationListItem[];
    reusedCount: number;
  }) => void;
}) {
  const [parentId, setParentId] = useState("");
  const [drafts, setDrafts] = useState<LevelDraft[]>([createLevelDraft(true)]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const levels = useMemo(() => drafts.map(toGeneratorLevel), [drafts]);
  const issues = useMemo(() => validateLocationGeneratorLevels(levels), [levels]);
  const plan = useMemo(
    () => (issues.length === 0 ? planLocationHierarchy(levels) : []),
    [issues, levels]
  );
  const resolved = useMemo(
    () =>
      resolvePlannedLocations(
        plan,
        parentId || null,
        locations.map((location) => ({
          id: location.id,
          parentId: location.parentId,
          normalizedName: normalizeLocationName(location.name)
        }))
      ),
    [plan, parentId, locations]
  );
  const newCount = plan.filter((planned) => resolved.get(planned.key) === null).length;
  const existingCount = plan.length - newCount;
  const issueMessages = issues.map((issue) => describeIssue(copy, issue));
  if (newCount > LOCATION_GENERATOR_MAX_NEW) {
    issueMessages.push(
      fillCopy(copy.issueTooManyNew, {
        count: formatInteger(newCount),
        max: formatInteger(LOCATION_GENERATOR_MAX_NEW)
      })
    );
  }

  const generateMutation = useMutation({
    mutationFn: generateLocationsForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) {
        setSubmitError(describeServerError(copy, result.error));
        return;
      }
      onGenerated({ parentId: parentId || null, ...result.data });
    },
    onError: () => setSubmitError(copy.errorGeneric)
  });

  function updateDraft(index: number, patch: Partial<LevelDraft>) {
    setSubmitError(null);
    setDrafts((current) =>
      current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...patch } : draft))
    );
  }

  function setLevelCount(nextDrafts: LevelDraft[]) {
    setSubmitError(null);
    // Levels whose type was never picked follow the default: the deepest holds stock, the rest organize.
    setDrafts(
      nextDrafts.map((draft, index) =>
        draft.typeChosen ? draft : { ...draft, isAssignable: index === nextDrafts.length - 1 }
      )
    );
  }

  const inputClassName =
    "min-h-9 w-full min-w-0 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2 py-1 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]";
  const gridClassName =
    "grid grid-cols-[3.5rem_minmax(6rem,1fr)_7rem_5rem_5rem_7.5rem_minmax(6rem,1fr)_9rem_2.25rem] items-center gap-2";
  const previewRows = plan.slice(0, PREVIEW_ROW_LIMIT);

  return (
    <>
      <DialogBody className="grid flex-1 content-start gap-5">
        <div className="grid max-w-md gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
          <span>{copy.parentLocation}</span>
          <LocationTreeSelect
            allowOrganizational
            locations={locations}
            locationTree={locationTree}
            copy={{
              chooseLocation: copy.chooseParentLocation,
              searchLocations: copy.searchLocations,
              noMatchingLocations: copy.noMatchingLocations,
              expandLocation: copy.expandLocation,
              collapseLocation: copy.collapseLocation
            }}
            name="generator-parent"
            selectedId={parentId}
            onSelectedIdChange={(id) => {
              setSubmitError(null);
              setParentId(id);
            }}
            emptyLabel={copy.rootLocation}
            clearable={true}
            onClear={() => setParentId("")}
            className="w-full"
            buttonClassName={formLocationSelectButtonClassName}
          />
        </div>

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{copy.levels}</h3>
          <div
            className={`${gridClassName} text-xs font-medium text-[var(--color-text-muted)]`}
            aria-hidden="true"
          >
            <span>{copy.level}</span>
            <span>{copy.prefix}</span>
            <span>{copy.counter}</span>
            <span>{copy.start}</span>
            <span>{copy.count}</span>
            <span>{copy.padding}</span>
            <span>{copy.suffix}</span>
            <span>{copy.type}</span>
            <span />
          </div>
          <ol className="grid gap-2">
            {drafts.map((draft, index) => {
              const levelLabel = `${copy.level} ${index + 1}`;
              return (
                <li key={index} className={gridClassName}>
                  <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                    {index + 1}
                  </span>
                  <input
                    aria-label={`${levelLabel} ${copy.prefix}`}
                    className={inputClassName}
                    value={draft.prefix}
                    onChange={(event) => updateDraft(index, { prefix: event.target.value })}
                  />
                  <select
                    aria-label={`${levelLabel} ${copy.counter}`}
                    className={inputClassName}
                    value={draft.counter}
                    onChange={(event) => {
                      const counter = event.target.value as LocationCounterKind;
                      updateDraft(index, { counter, start: counter === "numeric" ? "1" : "A" });
                    }}
                  >
                    <option value="numeric">{copy.numbers}</option>
                    <option value="alphabetic">{copy.letters}</option>
                  </select>
                  <input
                    aria-label={`${levelLabel} ${copy.start}`}
                    className={inputClassName}
                    value={draft.start}
                    onChange={(event) => updateDraft(index, { start: event.target.value })}
                  />
                  <input
                    aria-label={`${levelLabel} ${copy.count}`}
                    className={inputClassName}
                    inputMode="numeric"
                    value={draft.count}
                    onChange={(event) => updateDraft(index, { count: event.target.value })}
                  />
                  <select
                    aria-label={`${levelLabel} ${copy.padding}`}
                    className={inputClassName}
                    disabled={draft.counter === "alphabetic"}
                    value={draft.padding}
                    onChange={(event) => updateDraft(index, { padding: event.target.value })}
                  >
                    <option value="auto">{copy.paddingAuto}</option>
                    <option value="1">{copy.paddingNone}</option>
                    {PADDING_DIGIT_OPTIONS.map((digits) => (
                      <option key={digits} value={String(digits)}>
                        {fillCopy(copy.paddingDigits, { digits: String(digits) })}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`${levelLabel} ${copy.suffix}`}
                    className={inputClassName}
                    value={draft.suffix}
                    onChange={(event) => updateDraft(index, { suffix: event.target.value })}
                  />
                  <select
                    aria-label={`${levelLabel} ${copy.type}`}
                    className={inputClassName}
                    value={draft.isAssignable ? "assignable" : "organizational"}
                    onChange={(event) =>
                      updateDraft(index, {
                        isAssignable: event.target.value === "assignable",
                        typeChosen: true
                      })
                    }
                  >
                    <option value="organizational">{copy.organizational}</option>
                    <option value="assignable">{copy.assignable}</option>
                  </select>
                  <button
                    aria-label={`${copy.removeLevel} ${index + 1}`}
                    className="grid h-9 w-9 place-items-center rounded-md border border-[var(--color-border-strong)] text-[var(--color-text-muted)] transition hover:border-[var(--color-error-border)] hover:text-[var(--color-error)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={drafts.length === 1}
                    title={copy.removeLevel}
                    type="button"
                    onClick={() =>
                      setLevelCount(drafts.filter((_, draftIndex) => draftIndex !== index))
                    }
                  >
                    <span aria-hidden="true" className="text-base leading-none">
                      ×
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs leading-5 text-[var(--color-text-muted)]">{copy.tokenHelp}</p>
            <DialogSecondaryButton
              onClick={() => setLevelCount([...drafts, createLevelDraft(false)])}
            >
              {copy.addLevel}
            </DialogSecondaryButton>
          </div>
        </section>

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{copy.preview}</h3>
          {issueMessages.length > 0 ? (
            <ul className="grid gap-1 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-soft)] px-3 py-2 text-sm text-[var(--color-error)]">
              {issueMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
          {plan.length > 0 ? (
            <>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {newCount === 0
                  ? copy.nothingNew
                  : fillCopy(copy.previewSummary, {
                      new: formatInteger(newCount),
                      existing: formatInteger(existingCount)
                    })}
              </p>
              <ol className="max-h-72 overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2 text-sm">
                {previewRows.map((planned) => {
                  const exists = resolved.get(planned.key) !== null;
                  return (
                    <li
                      key={planned.key}
                      className="flex min-h-6 items-center gap-2"
                      style={{ paddingLeft: `${planned.depth * 1.25}rem` }}
                    >
                      <span
                        className={
                          exists
                            ? "text-[var(--color-text-muted)]"
                            : "font-medium text-[var(--color-text-primary)]"
                        }
                      >
                        {planned.name}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {exists
                          ? copy.exists
                          : planned.isAssignable
                            ? copy.assignable
                            : copy.organizational}
                      </span>
                    </li>
                  );
                })}
                {plan.length > previewRows.length ? (
                  <li className="pt-1 text-xs text-[var(--color-text-muted)]">
                    {fillCopy(copy.previewMore, {
                      count: formatInteger(plan.length - previewRows.length)
                    })}
                  </li>
                ) : null}
              </ol>
            </>
          ) : null}
        </section>
      </DialogBody>
      <DialogActions
        actionLabel={copy.generate}
        disabled={generateMutation.isPending || issueMessages.length > 0 || newCount === 0}
        error={submitError}
        onAction={() => {
          setSubmitError(null);
          generateMutation.mutate({
            workspaceSlug,
            parentId: parentId || null,
            levels
          });
        }}
      />
    </>
  );
}

function createLevelDraft(isAssignable: boolean): LevelDraft {
  return {
    prefix: "",
    suffix: "",
    counter: "numeric",
    start: "1",
    count: "5",
    padding: "auto",
    isAssignable,
    typeChosen: false
  };
}

function toGeneratorLevel(draft: LevelDraft): LocationGeneratorLevel {
  const count = draft.count.trim();
  return {
    prefix: draft.prefix,
    suffix: draft.suffix,
    counter: draft.counter,
    start: draft.start,
    count: /^\d+$/.test(count) ? Number(count) : Number.NaN,
    padding: draft.padding === "auto" ? "auto" : Number(draft.padding),
    isAssignable: draft.isAssignable
  };
}

function describeIssue(copy: LocationGeneratorCopy, issue: LocationGeneratorIssue) {
  if (issue.code === "no-levels") return copy.issueNoLevels;
  if (issue.code === "too-many-planned") {
    return fillCopy(copy.issueTooManyPlanned, {
      max: formatInteger(LOCATION_GENERATOR_MAX_PLANNED)
    });
  }
  const level = String(issue.level + 1);
  if (issue.code === "invalid-count") {
    return fillCopy(copy.issueCount, { level, max: formatInteger(LOCATION_GENERATOR_MAX_NEW) });
  }
  if (issue.code === "invalid-start") return fillCopy(copy.issueStart, { level });
  if (issue.code === "invalid-padding") return fillCopy(copy.issuePadding, { level });
  return fillCopy(copy.issueToken, { level });
}

function describeServerError(copy: LocationGeneratorCopy, error: string) {
  if (error === "too-many-generated-locations") {
    return fillCopy(copy.errorTooManyNew, { max: formatInteger(LOCATION_GENERATOR_MAX_NEW) });
  }
  if (error === "invalid-parent-location") return copy.errorParentMissing;
  if (error === "duplicate-location-name") return copy.errorDuplicate;
  return copy.errorGeneric;
}

/** Fill `{name}` placeholders in a copy template. */
function fillCopy(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => values[name] ?? placeholder);
}

function formatInteger(value: number) {
  return value.toLocaleString("en");
}
