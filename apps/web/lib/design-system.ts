/** Product semantics shared by badges, page identities and navigation. */
export type Tone = "brand" | "teal" | "success" | "warning" | "danger" | "info" | "advanced" | "neutral";

export function statusTone(value: string): Tone {
  const status = value.toUpperCase();
  if (/CONFLICT|INVALID|REJECTED|FAILED|OVERDUE|EXPIRED|DELETION|ERROR/.test(status)) return "danger";
  if (/INCOMPLETE|MISSING|DRAFT|PENDING|ONBOARDING|WARNING|ATTENTION|UNPAID|UNSIGNED|NOT_PAID|NOT_SIGNED|NOT_READY|AWAITING/.test(status)) return "warning";
  if (/INACTIVE|CANCELLED|ARCHIVED|NOT_STARTED|UNASSIGNED/.test(status)) return "neutral";
  if (/HALF_DAY|NON_WORKING|HOLIDAY/.test(status)) return "teal";
  if (/ACTIVE|PAID|APPROVED|COMPLETE|CONFIGURED|PUBLISHED|READY|SIGNED|WORKING_DAY/.test(status)) return "success";
  if (/ADVANCED|OVERRIDE|SPECIAL/.test(status)) return "advanced";
  if (/INFO|SCHEDULED/.test(status)) return "info";
  return "neutral";
}

export function pageTone(title: string): Tone {
  if (/school|classroom|calendar|academic year/i.test(title)) return "teal";
  if (/subscription|agreement|licens/i.test(title)) return "advanced";
  if (/onboarding|activation/i.test(title)) return "info";
  if (/request|review/i.test(title)) return "warning";
  return "brand";
}
