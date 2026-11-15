import { describe, expect, it } from "vitest";
import { schoolEntryDestination, operationalYear, structureStatus, structureAction, structureStatuses } from "../packages/domain/src/portal";
const now = new Date("2026-11-15T12:00:00Z");
const year=(id:string,start:string,end:string)=>({id,startsAt:start,endsAt:end});
const previous=year("past","2025-04-01","2026-03-31"),current=year("current","2026-04-01","2027-03-31"),future=year("future","2027-04-01","2028-03-31");
describe("Client portal academic-year selection",()=>{
 it("represents a school once using its current year rather than a future draft",()=>expect(operationalYear([future,previous,current],undefined,now)?.id).toBe("current"));
 it("honours an explicitly selected historical year",()=>expect(operationalYear([future,previous,current],"past",now)?.id).toBe("past"));
 it("ignores a year ID that belongs to another school",()=>expect(operationalYear([previous,current],"foreign",now)?.id).toBe("current"));
 it("uses the latest started year when no current year exists",()=>expect(operationalYear([future,previous],undefined,now)?.id).toBe("past"));
 it("uses the earliest upcoming year when no year has started",()=>expect(operationalYear([year("later","2028-04-01","2029-03-31"),future],undefined,now)?.id).toBe("future"));
 it("returns no year for an unconfigured school",()=>expect(operationalYear([],undefined,now)).toBe(null));
 it("does not reorder the caller's years",()=>{const years=[previous,current];operationalYear(years,undefined,now);expect(years).toEqual([previous,current]);});
 it("resolves overlapping current years deterministically",()=>expect(operationalYear([current,year("new","2026-10-01","2027-09-30")],undefined,now)?.id).toBe("new"));
});
describe("Authoritative structure status and quick actions",()=>{
 it("supports not started with no year or no revision",()=>{expect(structureStatus(null)).toBe("NOT_STARTED");expect(structureStatus({})).toBe("NOT_STARTED");});
 it("distinguishes an initial draft",()=>expect(structureStatus({draftRevisionId:"draft"})).toBe("DRAFT"));
 it("distinguishes draft changes while a publication remains active",()=>expect(structureStatus({draftRevisionId:"draft",publishedRevisionId:"active",publishedRevision:{status:"ACTIVE"}})).toBe("DRAFT_CHANGES_PENDING"));
 it("preserves incomplete active warnings",()=>expect(structureStatus({publishedRevisionId:"active",publishedRevision:{status:"INCOMPLETE_ACTIVE"}})).toBe("INCOMPLETE_ACTIVE"));
 it("identifies an active publication",()=>expect(structureStatus({publishedRevisionId:"active",publishedRevision:{status:"ACTIVE"}})).toBe("ACTIVE"));
 it.each(structureStatuses)("provides a valid action for %s",(status)=>expect(structureAction(status)).toBeTruthy());
});


describe("Distinct client school entry points", () => {
 it.each(["Schools", "Overview"])("%s school clicks always inspect details", (section) => {
   for (const status of structureStatuses) expect(schoolEntryDestination(section, "ACTIVE", status)).toEqual({view:"details",intent:"default"});
 });
 it("Structure Management school selection opens the school workspace", () => expect(schoolEntryDestination("Structure Management","ACTIVE","DRAFT")).toEqual({view:"workspace",intent:"default"}));
 it("pending structure drafts lead to review", () => expect(schoolEntryDestination("Structure Management","ACTIVE","DRAFT_CHANGES_PENDING")).toEqual({view:"workspace",intent:"review"}));
 it("incomplete structure completion requests an editable draft", () => expect(schoolEntryDestination("Structure Management","ACTIVE","INCOMPLETE_ACTIVE")).toEqual({view:"workspace",intent:"edit"}));
 it("Review & History retains its own entry", () => expect(schoolEntryDestination("Review & History","ACTIVE","ACTIVE")).toEqual({view:"workspace",intent:"review"}));
 it("inactive schools can only open read-only details", () => expect(schoolEntryDestination("Structure Management","INACTIVE","ACTIVE")).toEqual({view:"details",intent:"default"}));
});
