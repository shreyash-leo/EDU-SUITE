"use client";
import { useEffect, useState } from "react";
import { Form } from "../../components/ui";
import { api, type RecordData } from "../../lib/api";
import { copyRuleClassification } from "../../../../packages/domain/src/refinement";
import {
  copyYear,
  countClassrooms,
  type Config,
} from "../../../../packages/domain/src";

export function AcademicYearForm({
  years,
  onSubmit,
}: {
  years: RecordData[];
  onSubmit: (v: RecordData) => Promise<void>;
}) {
  const [anchors, setAnchors] = useState("keep"),
    [overlapReason, setOverlapReason] = useState("");
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState<RecordData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    setPreview(null);
    setError("");
    if (!source) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const year = years.find((y) => y.id === source);
    // Match backend copying: use the current publication when one exists.
    void api(
      `/years/${source}/config${year?.publishedRevisionId ? `?revisionId=${year.publishedRevisionId}` : ""}`,
    )
      .then((r) => {
        if (!current) return;
        const original = r.config as Config,
          copied = copyYear(original, {
            anchors: anchors as "keep" | "drop" | "rebase",
            start: String(r.year.startsAt).slice(0, 10),
          });
        const categories = original.boards
          .flatMap((b) => [...b.events, ...b.schedules])
          .map((r) => copyRuleClassification(r.rule));
        setPreview({
          safeRules: categories.filter((c) => c === "safe-recurring").length,
          fixedRules: categories.filter((c) => c === "fixed-date").length,
          boundedRules: categories.filter((c) => c === "date-bounded").length,
          anchorReview: original.boards
            .flatMap((b) => [...b.schedules, ...b.events])
            .filter((r) => copyRuleClassification(r.rule) === "anchor-review")
            .length,
          boards: copied.boards.length,
          sections: copied.boards.reduce((n, b) => n + b.sections.length, 0),
          grades: copied.boards.reduce((n, b) => n + b.grades.length, 0),
          classrooms: countClassrooms(copied),
          schedules: copied.boards.reduce((n, b) => n + b.schedules.length, 0),
          calendarRules: copied.boards.reduce((n, b) => n + b.events.length, 0),
          excluded:
            original.boards.reduce(
              (n, b) => n + b.events.length + b.schedules.length,
              0,
            ) -
            copied.boards.reduce(
              (n, b) => n + b.events.length + b.schedules.length,
              0,
            ),
        });
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [source, years, anchors]);
  return (
    <>
      <label>
        Starting configuration
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Start fresh</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              Copy {y.label}
            </option>
          ))}
        </select>
      </label>
      {loading && <p role="status">Loading copy preview…</p>}
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      {preview ? (
        <div className="notice copy-preview">
          <strong>Copy preview</strong>
          <span>
            {preview.safeRules} safe recurring rules · {preview.fixedRules}{" "}
            fixed-date rules · {preview.boundedRules} date-bounded rules.{" "}
            {preview.anchorReview} interval recurrences require anchor review.
            Fixed-date and bounded rules are excluded; other recurring rules are
            reusable.
          </span>
          <label>
            Interval recurrence anchors
            <select
              value={anchors}
              onChange={(e) => setAnchors(e.target.value)}
            >
              <option value="keep">Keep existing anchors</option>
              <option value="rebase">Rebase cycle to new year start</option>
              <option value="drop">Exclude interval recurrences</option>
            </select>
          </label>
          <span>
            {preview.boards} boards · {preview.sections} sections ·{" "}
            {preview.grades} grades · {preview.classrooms} classrooms
          </span>
          <span>
            {preview.schedules} reusable bell schedules ·{" "}
            {preview.calendarRules} calendar rules
          </span>
          <span>
            Excluded: {preview.excluded} fixed-date, date-bounded or
            intentionally omitted interval rules.
          </span>
          <span>
            Check the new dates and recurrence anchors before applying. Copies
            remain independent.
          </span>
        </div>
      ) : (
        !source && (
          <div className="notice">
            Start a blank configuration using this school’s registered boards
            and three-part scheduling.
          </div>
        )
      )}
      <section className="academic-overlap-card" aria-labelledby="overlap-title">
        <div><strong id="overlap-title">Do these dates intentionally overlap another academic year?</strong><p>Leave this blank for a normal academic year. If the dates overlap, explain the approved exception.</p></div>
        <label>Overlap exception reason (optional)<input value={overlapReason} placeholder="Only required for overlapping dates" onChange={(e) => setOverlapReason(e.target.value)}/></label>
      </section>
      <Form
        extraDirty={!!source || anchors !== "keep" || !!overlapReason}
        onDiscard={() => {
          setSource("");
          setAnchors("keep");
          setOverlapReason("");
        }}
        fields={[
          { key: "label", label: "Academic year", required: true },
          { key: "start", label: "Start date", type: "date", required: true },
          { key: "end", label: "End date", type: "date", required: true },
        ]}
        initial={{
          label: `${new Date().getUTCFullYear()}–${String(new Date().getUTCFullYear() + 1).slice(2)}`,
          start: `${new Date().getUTCFullYear()}-04-01`,
          end: `${new Date().getUTCFullYear() + 1}-03-31`,
        }}
        submit="Create academic year"
        onSubmit={async (v) => {
          if (source && (loading || !preview))
            throw Error(
              error || "Wait for the copy preview before creating the year",
            );
          const overlaps = years.filter(
            (y) =>
              v.start <= String(y.endsAt).slice(0, 10) &&
              v.end >= String(y.startsAt).slice(0, 10),
          );
          if (overlaps.length && overlapReason.trim().length < 10)
            throw Error(
              `Dates overlap ${overlaps.map((y) => y.label).join(", ")}. Enter an overlap exception reason.`,
            );
          await onSubmit({
            ...v,
            resolverVersion: source ? undefined : 2,
            copyFrom: source || undefined,
            anchors,
            overlapReason: overlapReason.trim() || undefined,
          });
        }}
      />
    </>
  );
}
