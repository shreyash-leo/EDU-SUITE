import { applicableRules, matches, targetRank, validateSlots, type Board, type Config, type Schedule, type Target, type Rule } from "./index";
type Event = Board["events"][number];
export const holidayPart = (event: Event) => event.configurationPart || (event.kind === "holiday" ? "default-holidays" : "advanced");
const datePriority = (rule: Rule) => rule.type === "date" ? 3 : rule.type === "default" ? 0 : rule.nth || rule.startsOn || rule.endsOn ? 2 : 1;
const priority = (entry: {target: Target; rule: Rule}, board: Board, room: string) => datePriority(entry.rule) * 10 + targetRank(entry.target, board, room);
/** A family is identified by permanent references, never by display names. */
function root(event: Event, all: Event[]) {
  let current = event;
  const visited = new Set<string>();
  while (current.parentId) {
    if (visited.has(current.id)) return null;
    visited.add(current.id);
    const parent = all.find(e => e.id === current.parentId);
    if (!parent) return null;
    current = parent;
  }
  return current.id;
}
function ancestor(id: string, event: Event, all: Event[]) {
  const seen = new Set<string>();
  while (event.parentId && !seen.has(event.id)) {
    seen.add(event.id);
    if (event.parentId === id) return true;
    const parent = all.find(e => e.id === event.parentId);
    if (!parent) break;
    event = parent;
  }
  return false;
}
export function schedulingIssues(config: Config, start: string, end: string): string[] {
  const errors: string[] = [];
  const all = config.boards.flatMap(b => b.events);
  for (const b of config.boards) for (const e of b.events) {
    if (holidayPart(e) === "default-holidays" && e.kind !== "holiday") errors.push(`${e.name}: Default Holidays only accepts holidays`);
    if (e.operation === "timing" && (e.kind !== "working" || holidayPart(e) !== "advanced" || !e.scheduleId)) errors.push(`${e.name}: a timing rule requires an advanced working action and complete bell schedule`);
    if (e.overridesHoliday) errors.push(`${e.name}: replace the relevant holiday through a Default Holidays override; advanced reopening is unavailable`);
    if (!root(e, all)) errors.push(`${e.name}: holiday/rule parent is missing or cyclic`);
    if (e.parentId) {
      const parent = all.find(p => p.id === e.parentId);
      if (parent && !!parent.operation !== !!e.operation) errors.push(`${e.name}: timing-only rules cannot replace calendar-status rules`);
      if (parent && holidayPart(parent) !== holidayPart(e)) errors.push(`${e.name}: parent must belong to the same scheduling part`);
      // Every child target must be a narrower subset, even across shared boards.
      let affected = 0;
      for (const owner of config.boards) for (const g of owner.grades) for (const room of g.classrooms) {
        const visible = applicableRules(owner, config).events;
        if (!visible.some(x => x.id === e.id) || !targetRank(e.target, owner, room.id)) continue;
        affected++;
        if (parent && (!visible.some(x => x.id === parent.id) || targetRank(e.target, owner, room.id) <= targetRank(parent.target, owner, room.id) || !targetRank(parent.target, owner, room.id))) errors.push(`${e.name}: override targets must be inside and more specific than the parent`);
      }
      if (!affected) errors.push(`${e.name}: override must target at least one classroom`);
    }
    if (e.scheduleId) {
      const schedules = applicableRules(b, config).schedules;
      if (!schedules.some(s => s.id === e.scheduleId)) errors.push(`${e.name}: linked schedule is missing`);
      if (e.kind === "holiday" || holidayPart(e) !== "advanced") errors.push(`${e.name}: only advanced working or half-day rules can select a schedule`);
    }
  }
  for (const b of config.boards) for (const item of [...b.events, ...b.schedules]) for (const date of [item.rule.date, item.rule.startsOn, item.rule.endsOn].filter(Boolean) as string[]) if (date < start || date > end) errors.push(`${item.name}: date ${date} is outside the academic year`);
  return [...new Set(errors)];
}
/** Explicitly adopted only by a working draft. The input and published revisions are untouched. */
export function adoptScheduling(config: Config, makeId: () => string = () => crypto.randomUUID()): Config {
  return {...config, resolverVersion: 2, boards: config.boards.map(b => ({
    ...b,
    nonWorkingDays: [],
    events: [
      ...b.events.map(e => ({...e, configurationPart: holidayPart(e)})),
      ...[...new Set(b.nonWorkingDays)].map(day => ({
        id: makeId(), name: `${b.name} · Every ${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][day]}`,
        kind: "holiday" as const, configurationPart: "default-holidays" as const,
        target: {scope:"board" as const,ids:[]}, rule: {type:"weekly" as const,weekdays:[day],intervalWeeks:1},
      })),
    ],
  }))};
}
/** Weekly baseline excludes one-off/monthly/advanced changes; those remain in
 * observed working-day counts. It follows the same holiday-family inheritance. */
export function regularWorkingDays(board: Board, classroom: string, config: Config): number | null {
  const all=config.boards.flatMap(b=>b.events);
  const families=new Map<string,Event[]>();
  for(const event of applicableRules(board,config).events) {
    if(holidayPart(event)!=="default-holidays" || !targetRank(event.target,board,classroom))continue;
    const family=root(event,all);
    if(!family)return null;
    families.set(family,[...families.get(family) || [],event]);
  }
  const closed=new Set(board.nonWorkingDays);
  for(const family of families.values()) {
    const rank=Math.max(...family.map(e=>targetRank(e.target,board,classroom)));
    const winners=family.filter(e=>targetRank(e.target,board,classroom)===rank);
    if(winners.length!==1)return null;
    const rule=winners[0].rule;
    if(rule.startsOn || rule.endsOn)continue;
    if(rule.type==="default")[0,1,2,3,4,5,6].forEach(day=>closed.add(day));
    else if(["weekly","recurring"].includes(rule.type) && !rule.nth && rule.intervalWeeks===1)rule.weekdays.forEach(day=>closed.add(day));
  }
  return 7-closed.size;
}
export function resolveV2(b: Board, classroom: string, date: string, config: Config) {
  const rules = applicableRules(b, config);
  const conflict = (reason: string, ids: string[]) => ({status: "conflict", reason, conflicts: ids});
  // Select each holiday family's target override BEFORE matching dates. This lets a
  // shorter vacation remove only its own parent's excluded dates.
  const families = new Map<string, Event[]>();
  for (const e of rules.events.filter(e => holidayPart(e) === "default-holidays" && targetRank(e.target,b,classroom))) {
    const key = root(e, config.boards.flatMap(b=>b.events));
    if (!key) return conflict("Holiday family has a missing or cyclic parent", [e.id]);
    families.set(key, [...families.get(key) || [], e]);
  }
  const closed: Event[] = [];
  for (const family of families.values()) {
    const sorted = family.sort((a,c)=>targetRank(c.target,b,classroom)-targetRank(a.target,b,classroom));
    const top = sorted.filter(e=>targetRank(e.target,b,classroom)===targetRank(sorted[0].target,b,classroom));
    if (top.length > 1) return conflict("Conflicting overrides in the same holiday family",top.map(e=>e.id));
    if (matches(top[0].rule,date)) closed.push(top[0]);
  }
  if (closed.length) return {status:"holiday",reason:`Default holiday: ${closed.map(e=>e.name).join("; ")}`,calendarRuleId:closed[0].id};
  if (b.nonWorkingDays.includes(new Date(date+"T00:00:00Z").getUTCDay())) return {status:"non-working",reason:"Default weekly holiday"};
  const applicable = rules.events.filter(e=>holidayPart(e)==="advanced" && targetRank(e.target,b,classroom) && matches(e.rule,date));
  const surviving = applicable.filter(parent=>!applicable.some(child=>!!parent.operation===!!child.operation && ancestor(parent.id,child,rules.events)));
  let advanced = surviving.filter(e=>!e.operation);
  advanced.sort((a,c)=>priority(c,b,classroom)-priority(a,b,classroom));
  const top = advanced.filter(e=>priority(e,b,classroom)===priority(advanced[0],b,classroom));
  if (top.length > 1) return conflict("Equal-priority advanced rules require an explicit override",top.map(e=>e.id));
  const event = top[0];
  if (event?.kind === "holiday") return {status:"holiday",reason:`Advanced non-working rule: ${event.name}`,calendarRuleId:event.id};
  const candidates = rules.schedules.filter(s=>!s.templateOnly && targetRank(s.target,b,classroom) && matches(s.rule,date)).map(s=>({s,rank:priority(s,b,classroom),source:undefined as Event | undefined}));
  const timingEvents = surviving.filter(e=>e.operation === "timing");
  for (const timedEvent of [...timingEvents, ...(event?.scheduleId ? [event] : [])]) {
    const s = rules.schedules.find(s=>s.id===timedEvent.scheduleId);
    if (!s) return {status:"invalid",reason:`${timedEvent.name}: linked bell schedule is missing`};
    // Linked templates supply a complete day; the event controls target and occurrence.
    const existing = candidates.findIndex(x=>x.s.id===s.id);
    if (existing >= 0 && !candidates[existing].source) candidates.splice(existing,1);
    candidates.push({s,rank:priority(timedEvent,b,classroom),source:timedEvent});
  }
  candidates.sort((a,c)=>c.rank-a.rank);
  // A more-specific full-working exception cancels a broader half-day template.
  const eligible = event?.kind === "working" ? candidates.filter(x=>x.rank>=priority(event,b,classroom) || !x.source && x.s.rule.type==="default") : candidates;
  const expectedDayType = event?.kind === "half-day" ? "half" as const : "full" as const;
  if (!eligible.length) return {status:"missing",reason:`No applicable ${expectedDayType}-day bell schedule`,expectedDayType};
  const best = eligible.filter(x=>x.rank===eligible[0].rank);
  if (best.length > 1) return conflict(`Equal-priority schedules: ${best.map(x=>x.source?.name || x.s.name).join(", ")}`,best.map(x=>x.source?.id || x.s.id));
  const selected = best[0];
  const errors = validateSlots(selected.s);
  if (event?.kind === "half-day" && (selected.s.dayType!=="half" || selected.rank<priority(event,b,classroom))) errors.push("Half-day requires a matching complete half-day schedule");
  if (event?.kind === "working" && selected.s.dayType === "half") errors.push("Full working day requires a complete full-day schedule");
  if (errors.length) return {status:"invalid",schedule:selected.s,reason:errors.join("; ")};
  return {status:"working",schedule:selected.s,calendarRuleId:event?.id || selected.source?.id,winningRule:{id:selected.s.id,ruleType:selected.s.rule.type,scope:selected.s.target.scope,priority:selected.rank},reason:`${event ? event.name+" · " : selected.source ? selected.source.name+" · " : selected.s.rule.type === "default" ? "Inherited default · " : "Advanced timing · "}${selected.s.name} · ${selected.s.dayType==="half"?"Half-day":"Working day"} · ${selected.s.target.scope}`};
}
