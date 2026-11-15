export const structureStatuses = ["NOT_STARTED", "DRAFT", "INCOMPLETE_ACTIVE", "ACTIVE", "DRAFT_CHANGES_PENDING"] as const;
export type StructureStatus = typeof structureStatuses[number];
export function structureStatus(year?: { draftRevisionId?: string | null; publishedRevisionId?: string | null; publishedRevision?: { status: string } | null } | null): StructureStatus {
  if (!year) return "NOT_STARTED";
  if (year.draftRevisionId) return year.publishedRevisionId ? "DRAFT_CHANGES_PENDING" : "DRAFT";
  return year.publishedRevisionId ? year.publishedRevision?.status === "INCOMPLETE_ACTIVE" ? "INCOMPLETE_ACTIVE" : "ACTIVE" : "NOT_STARTED";
}
export function operationalYear<T extends { id: string; startsAt: string | Date; endsAt: string | Date }>(years: T[], selected?: string, now = new Date()): T | null {
  const explicit = years.find((y) => y.id === selected); if (explicit) return explicit;
  const time = now.getTime(), sorted = [...years].sort((a,b) => new Date(b.startsAt).getTime()-new Date(a.startsAt).getTime() || a.id.localeCompare(b.id));
  return sorted.find((y) => new Date(y.startsAt).getTime() <= time && new Date(y.endsAt).getTime() >= time) || sorted.find((y) => new Date(y.startsAt).getTime() <= time) || [...years].sort((a,b) => new Date(a.startsAt).getTime()-new Date(b.startsAt).getTime() || a.id.localeCompare(b.id))[0] || null;
}
export function structureAction(status: StructureStatus) {
  return ({ NOT_STARTED: "Start Configuration", DRAFT: "Continue Configuration", INCOMPLETE_ACTIVE: "Complete Missing Details", ACTIVE: "Open Configuration", DRAFT_CHANGES_PENDING: "Review Changes" })[status];
}

/** Entry points stay distinct: inspection never implicitly opens an editor. */
export function schoolEntryDestination(section: string, accountStatus: string, status: StructureStatus): { view: "details" | "workspace"; intent: "default" | "review" | "edit" } {
  if (accountStatus !== "ACTIVE") return { view: "details", intent: "default" };
  if (section === "Review & History") return { view: "workspace", intent: "review" };
  if (section === "Structure Management") return { view: "workspace", intent: status === "DRAFT_CHANGES_PENDING" ? "review" : status === "INCOMPLETE_ACTIVE" ? "edit" : "default" };
  return { view: "details", intent: "default" };
}
