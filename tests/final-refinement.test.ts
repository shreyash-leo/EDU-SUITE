import { describe,it,expect } from "vitest";
import { assistedAssign,copyRuleClassification,classroomCounts,effectiveImpact } from "../packages/domain/src/refinement";
import { duplicateTemplates } from "../packages/domain/src/refinement";
import { configurationImpact } from "../packages/domain/src/impact";
import { autoAssign,copyYear,emptyConfig,matches,type Slot } from "../packages/domain/src";
import { randomUUID as id } from "node:crypto";
describe("Final refinement scheduling and copy",()=>{
 const period=(duration:number,name:string):Slot=>({id:id(),kind:"period",name,start:0,end:duration});
 it("finds an alternate whole-period arrangement preserving identities and routines",()=>{
  const p=[period(40,"A"),period(60,"B"),period(20,"C")],routine:Slot={id:id(),name:"Break",kind:"routine",start:540,end:550};
  expect(()=>autoAssign(480,610,[40,60,20],[routine],id)).toThrow();
  const slots=assistedAssign(480,610,p,[routine]);
  expect(slots.map(s=>s.name)).toEqual(["A","C","Break","B"]);
  expect(slots.find(s=>s.id===routine.id)).toEqual(routine);
  for(const original of p)expect(slots.find(s=>s.id===original.id)!.end-slots.find(s=>s.id===original.id)!.start).toBe(original.end);
 });
 it("rejects impossible, excess and bounded-search cases",()=>{
  const r:Slot={id:id(),name:"Break",kind:"routine",start:530,end:540};
  expect(()=>assistedAssign(480,610,[period(60,"A"),period(60,"B")],[r])).toThrow(/No whole-period/);
  expect(()=>assistedAssign(480,610,[period(70,"A"),period(60,"B")],[r])).toThrow(/excess/);
  expect(()=>assistedAssign(480,600,[period(60,"A"),period(60,"B")],[],1)).toThrow(/safe limit/);
 });
 it("includes every holiday range date across the year boundary",()=>{
  const rule={type:"recurring" as const,weekdays:[0,1,2,3,4,5,6],intervalWeeks:1,startsOn:"2026-12-24",endsOn:"2027-01-02"};
  expect(matches(rule,"2026-12-23")).toBe(false);expect(matches(rule,"2026-12-24")).toBe(true);expect(matches(rule,"2027-01-02")).toBe(true);expect(matches(rule,"2027-01-03")).toBe(false);
 });
 it("classifies copy rules and rebases or excludes interval recurrences",()=>{
  const c=emptyConfig(["CBSE","ICSE"],id),rule={type:"recurring" as const,weekdays:[6],intervalWeeks:2,anchorDate:"2026-04-01"};
  c.boards[0].events.push({id:id(),name:"Alternate Saturdays",kind:"holiday",target:{scope:"board",ids:[]},rule});
  expect(copyRuleClassification(rule)).toBe("anchor-review");
  expect(copyYear(c,{anchors:"rebase",start:"2027-04-01"}).boards[0].events[0].rule.anchorDate).toBe("2027-04-01");
  expect(copyYear(c,{anchors:"drop",start:"2027-04-01"}).boards[0].events).toEqual([]);
  expect(c.boards[0].events[0].rule.anchorDate).toBe("2026-04-01");
 });
 it("distinguishes classroom flags from operational status and licenses inactive rooms",()=>{
  const c=emptyConfig(["CBSE"],id);c.boards[0].grades.push({id:id(),name:"1",active:false,sectionId:null,classrooms:[{id:id(),name:"A",active:true},{id:id(),name:"B",active:false}]});
  expect(classroomCounts(c)).toEqual({total:2,activeFlags:1,operationallyActive:0,inactive:1,licensed:2});
  expect(effectiveImpact(c,c,"2026-11-01","2026-11-02").changedDates).toBe(0);
 });
});

it("identifies duplicate templates and potential cross-board schedule impacts",()=>{
 const c=emptyConfig(["CBSE","ICSE"],id);
 for(const b of c.boards)b.grades.push({id:id(),name:"1",active:true,sectionId:null,classrooms:[{id:id(),name:"A",active:true}]});
 const next=structuredClone(c), schedule={id:id(),name:"School day",arrival:480,dispersal:540,target:{scope:"school" as const,ids:[]},rule:{type:"default" as const,weekdays:[],intervalWeeks:1},slots:autoAssign(480,540,[60],[],id)};
 next.boards[0].schedules.push(schedule);
 const impact=configurationImpact(c,next);expect(impact.classrooms).toHaveLength(2);expect(impact.boardIds).toHaveLength(2);
 expect(effectiveImpact(c,next,"2026-11-16","2026-11-16")).toMatchObject({changedDates:1,classroomDates:2});
 expect(duplicateTemplates([schedule,{...schedule,id:id(),name:"Copy"}])).toHaveLength(1);
});
