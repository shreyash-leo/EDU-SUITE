import {describe,it,expect} from "vitest";
import {randomUUID as id} from "node:crypto";
import {emptyConfig,resolve,review,copyYear,removeFromConfig,type Config,type Schedule,type Target,type Rule} from "../packages/domain/src";
import {adoptScheduling,schedulingIssues} from "../packages/domain/src/scheduling";
import {calendarSummary,configurationChanges} from "../packages/domain/src/enhancements";
import {publishedOutput} from "../packages/domain/src/published-output";
const defaultRule:Rule={type:"default",weekdays:[],intervalWeeks:1};
const range=(a:string,b:string):Rule=>({type:"recurring",weekdays:[0,1,2,3,4,5,6],intervalWeeks:1,startsOn:a,endsOn:b});
const target=(scope:Target["scope"],...ids:string[]):Target=>({scope,ids});
function fixture(){
 const c=adoptScheduling(emptyConfig(["CBSE","ICSE"],id));
 for(const b of c.boards){b.events=[];b.nonWorkingDays=[];b.sections=[{id:id(),name:"Primary"},{id:id(),name:"Secondary"}];b.grades=[{id:id(),name:"Grade 4",active:true,sectionId:b.sections[0].id,classrooms:[{id:id(),name:"4A",active:true},{id:id(),name:"4B",active:true}]}];}
 const schedule=(t:Target,name="Normal",rule=defaultRule,half=false):Schedule=>({id:id(),name,arrival:480,dispersal:half?540:600,dayType:half?"half":"full",target:t,rule,slots:[{id:id(),name:"Teaching",kind:"period",start:480,end:half?540:600}]});
 const b=c.boards[0],g=b.grades[0],room=g.classrooms[0];
 b.schedules.push(schedule(target("school")));
 const get=(date="2026-11-04",roomId=room.id)=>resolve(b,roomId,date,c);
 return {c,b,g,room,get,schedule};
}
describe("three-part scheduling",()=>{
 it("inherits five levels and returns a whole template",()=>{
  const {b,g,room,c,get,schedule}=fixture();
  for(const [scope,ids] of [["board",[]],["sections",[b.sections[0].id]],["grades",[g.id]],["classrooms",[room.id]]] as [Target["scope"],string[]][]){b.schedules.push(schedule(target(scope,...ids),scope));expect(get().schedule?.name).toBe(scope);}
  expect(resolve(c.boards[1],c.boards[1].grades[0].classrooms[0].id,"2026-11-04",c).schedule?.name).toBe("Normal");
  expect(get().schedule?.slots).toHaveLength(1);
 });
 it("shortens and extends linked vacations without removing unrelated holidays",()=>{
  const {b,g,room,get,c}=fixture();
  const parent={id:id(),name:"Diwali",kind:"holiday" as const,configurationPart:"default-holidays" as const,target:target("school"),rule:range("2026-11-01","2026-11-05")};
  const section={...parent,id:id(),name:"Primary vacation",parentId:parent.id,target:target("sections",b.sections[0].id),rule:range("2026-11-01","2026-11-03")};
  const grade={...section,id:id(),name:"Grade vacation",parentId:section.id,target:target("grades",g.id),rule:range("2026-11-01","2026-11-04")};
  const child={...grade,id:id(),name:"Classroom vacation",parentId:grade.id,target:target("classrooms",room.id),rule:range("2026-11-01","2026-11-06")};
  b.events.push(parent,section,grade,child);
  expect(get("2026-11-05").status).toBe("holiday");expect(get("2026-11-05",g.classrooms[1].id).status).toBe("working");
  expect(get("2026-11-06").reason).toContain("Classroom vacation");expect(get("2026-11-07").status).toBe("working");
  b.events.push({...parent,id:id(),name:"Independent holiday",rule:{...defaultRule,type:"date",date:"2026-11-05"}});
  expect(get("2026-11-05",g.classrooms[1].id).reason).toContain("Independent holiday");
  expect(schedulingIssues(c,"2026-11-01","2027-03-31")).toEqual([]);
 });
 it("retains an independent Sunday after a vacation is shortened",()=>{
  const {b,room,get}=fixture();b.nonWorkingDays=[0];const parent={id:id(),name:"Vacation",kind:"holiday" as const,configurationPart:"default-holidays" as const,target:target("school"),rule:range("2026-11-01","2026-11-08")};
  b.events.push(parent,{...parent,id:id(),parentId:parent.id,target:target("classrooms",room.id),rule:range("2026-11-01","2026-11-03")});
  expect(get("2026-11-04").status).toBe("working");expect(get("2026-11-08").status).toBe("non-working");
 });
 it("resolves board holiday → section working → grade half → classroom working",()=>{
  const {b,g,room,get,schedule}=fixture();const rule:Rule={type:"recurring",weekdays:[6],nth:4,intervalWeeks:1};
  const parent={id:id(),name:"Fourth Saturday closed",kind:"holiday" as const,configurationPart:"advanced" as const,target:target("board"),rule};
  const section={...parent,id:id(),name:"Primary working",parentId:parent.id,kind:"working" as const,target:target("sections",b.sections[0].id)};
  b.events.push(parent,section);expect(get("2026-11-28").status).toBe("working");
  const half=schedule(target("school"),"Short day",defaultRule,true);half.templateOnly=true;b.schedules.push(half);
  const grade={...section,id:id(),name:"Grade half",parentId:section.id,kind:"half-day" as const,scheduleId:half.id,target:target("grades",g.id)};b.events.push(grade);
  expect(get("2026-11-28").schedule?.dayType).toBe("half");
  b.events.push({...section,id:id(),name:"Class full",parentId:grade.id,target:target("classrooms",room.id)});
  expect(get("2026-11-28").schedule?.dayType).toBe("full");expect(get("2026-11-28",g.classrooms[1].id).schedule?.dayType).toBe("half");
 });
 it("Default Holidays block advanced working and half-day rules",()=>{
  const {b,room,get}=fixture();b.events.push({id:id(),name:"Compulsory",kind:"holiday",configurationPart:"default-holidays",target:target("school"),rule:defaultRule},{id:id(),name:"Working",kind:"working",configurationPart:"advanced",overridesHoliday:true,target:target("classrooms",room.id),rule:{...defaultRule,type:"date",date:"2026-11-04"}});
  expect(get().status).toBe("holiday");expect(get().reason).toContain("Compulsory");
 });
 it("a bell timing cannot reopen an advanced holiday",()=>{
  const {b,room,get,schedule}=fixture();b.events.push({id:id(),name:"Closed",kind:"holiday",configurationPart:"advanced",target:target("school"),rule:defaultRule});b.schedules.push(schedule(target("classrooms",room.id),"Special",{...defaultRule,type:"date",date:"2026-11-04"}));expect(get().status).toBe("holiday");
 });
 it("flags schedule ties, holiday family ties and advanced rule ties",()=>{
  const {b,get,schedule}=fixture();b.schedules.push(schedule(target("school")));expect(get().status).toBe("conflict");b.schedules.pop();
  const parent={id:id(),name:"Vacation",kind:"holiday" as const,configurationPart:"default-holidays" as const,target:target("school"),rule:defaultRule};b.events.push(parent,...[1,2].map(n=>({...parent,id:id(),name:`Child ${n}`,parentId:parent.id,target:target("sections",b.sections[0].id)})));expect(get().status).toBe("conflict");
  b.events=[1,2].map(n=>({...parent,id:id(),name:`Advanced ${n}`,configurationPart:"advanced" as const}));expect(get().status).toBe("conflict");
 });
 it("validates parents, cycles, target containment, parts and missing linked schedules",()=>{
  const {b,c,room}=fixture();const e={id:id(),name:"Bad",kind:"holiday" as const,target:target("school"),rule:defaultRule,parentId:id()};b.events.push(e);expect(schedulingIssues(c,"2026-11-01","2027-03-31").join()).toMatch(/missing/);
  e.parentId=e.id;expect(schedulingIssues(c,"2026-11-01","2027-03-31").join()).toMatch(/cyclic/);
  b.events=[{...e,parentId:undefined},{...e,id:id(),parentId:e.id,configurationPart:"advanced",kind:"working",scheduleId:id(),target:target("classrooms",room.id)}];expect(schedulingIssues(c,"2026-11-01","2027-03-31").join()).toMatch(/same scheduling part/);expect(schedulingIssues(c,"2026-11-01","2027-03-31").join()).toMatch(/linked schedule is missing/);
 });
 it("specific dates override recurrence; fifth weekday skips absent months",()=>{
  const {b,room,get,schedule}=fixture();b.schedules.push(schedule(target("classrooms",room.id),"Friday",{type:"weekly",weekdays:[5],intervalWeeks:1}),schedule(target("board"),"Specific",{...defaultRule,type:"date",date:"2026-11-06"}));expect(get("2026-11-06").schedule?.name).toBe("Specific");
  b.events.push({id:id(),name:"Fifth Monday",kind:"holiday",configurationPart:"advanced",target:target("school"),rule:{type:"recurring",weekdays:[1],nth:5,intervalWeeks:1}});expect(get("2026-11-30").status).toBe("holiday");expect(get("2026-12-28").status).toBe("working");
 });
 it("linked existing defaults keep their normal coverage on other dates",()=>{
  const {b,get}=fixture();b.events.push({id:id(),name:"Special working",kind:"working",configurationPart:"advanced",target:target("school"),rule:{...defaultRule,type:"date",date:"2026-11-04"},scheduleId:b.schedules[0].id});expect(get().status).toBe("working");expect(get("2026-11-05").status).toBe("working");
 });
 it("section transfers re-resolve inherited timing without changing history",()=>{
  const {b,g,c,room,schedule}=fixture();b.schedules.push(schedule(target("sections",b.sections[1].id),"Secondary"));const before=structuredClone(c);g.sectionId=b.sections[1].id;expect(resolve(b,room.id,"2026-11-04",c).schedule?.name).toBe("Secondary");expect(resolve(before.boards[0],room.id,"2026-11-04",before).schedule?.name).toBe("Normal");
 });
 it("keeps legacy publication behavior and exposes the selected resolver",()=>{
  const {b,c,room}=fixture();delete c.resolverVersion;b.events.push({id:id(),name:"Vacation",kind:"holiday",target:target("school"),rule:{type:"recurring",weekdays:[3],intervalWeeks:1}},{id:id(),name:"Legacy reopening",kind:"working",overridesHoliday:true,target:target("classrooms",room.id),rule:{...defaultRule,type:"date",date:"2026-11-04"}});
  expect(resolve(b,room.id,"2026-11-04",c).status).toBe("working");const adopted=adoptScheduling(c);expect(resolve(adopted.boards[0],room.id,"2026-11-04",adopted).status).toBe("holiday");expect(c.resolverVersion).toBeUndefined();expect(configurationChanges(c,adopted).length).toBeGreaterThan(0);
  const result=publishedOutput(c,{organizationId:id(),schoolId:id(),academicYearId:id(),publishedRevisionId:id(),academicYearStart:"2026-11-01",academicYearEnd:"2026-11-30"},"2026-11-04","2026-11-04");expect(result.resolverVersion).toBe(1);expect(result.boards[0].grades[0].classrooms[0].dates[0].instructionalMinutes).toBe(120);
 });
 it("blocks missing or invalid operational schedules under v2 publication",()=>{
  const {b,c}=fixture();b.schedules=[];expect(review(c,100,"2026-11-04","2026-11-04").some(i=>i.severity==="error"&&/No applicable/.test(i.message))).toBe(true);
 });
 it("counts overlapping holidays once and uses actual instructional minutes",()=>{
  const {b,c}=fixture();b.events=[1,2].map(n=>({id:id(),name:`Holiday ${n}`,kind:"holiday" as const,configurationPart:"default-holidays" as const,target:target("school"),rule:{...defaultRule,type:"date" as const,date:"2026-11-04"}}));const summary=calendarSummary(c,"2026-11-04","2026-11-05",b.id);expect(summary.holidays).toBe(1);expect(summary.workingDays).toBe(1);expect(summary.instructionalMinutes).toBe(120);
 });
 it("keeps linked library templates dormant except on their event dates",()=>{
  const {b,get,schedule}=fixture();const special={...schedule(target("school"),"Library half",defaultRule,true),templateOnly:true};b.schedules.push(special);
  expect(get().schedule?.name).toBe("Normal");b.events.push({id:id(),name:"Short day",kind:"half-day",configurationPart:"advanced",scheduleId:special.id,target:target("school"),rule:{...defaultRule,type:"date",date:"2026-11-04"}});expect(get().schedule?.name).toBe("Library half");expect(get("2026-11-05").schedule?.name).toBe("Normal");
 });
 it("explicit advanced child replaces its parent despite lower date specificity",()=>{
  const {b,room,get}=fixture();const parent={id:id(),name:"Date closure",kind:"holiday" as const,configurationPart:"advanced" as const,target:target("school"),rule:{...defaultRule,type:"date" as const,date:"2026-11-04"}};b.events.push(parent,{id:id(),name:"Class working",kind:"working",configurationPart:"advanced",parentId:parent.id,target:target("classrooms",room.id),rule:{type:"weekly",weekdays:[3],intervalWeeks:1}});expect(get().status).toBe("working");
 });
 it("rejects missing half-day timing, out-of-year rules and impossible periods",()=>{
  const {b,c,get}=fixture();b.events.push({id:id(),name:"Half day",kind:"half-day",configurationPart:"advanced",target:target("school"),rule:defaultRule});expect(get().status).toBe("invalid");b.events=[];b.schedules[0].slots[0].end=599;expect(get().status).toBe("invalid");b.events.push({id:id(),name:"Wrong year",kind:"holiday",configurationPart:"default-holidays",target:target("school"),rule:{...defaultRule,type:"date",date:"2027-04-01"}});expect(schedulingIssues(c,"2026-11-01","2027-03-31").join()).toMatch(/outside the academic year/);
 });
 it("inherits board holiday overrides across shared multi-board families",()=>{
  const {b,c,get}=fixture();const parent={id:id(),name:"School vacation",kind:"holiday" as const,configurationPart:"default-holidays" as const,target:target("school"),rule:range("2026-11-01","2026-11-05")};b.events.push(parent);c.boards[1].events.push({...parent,id:id(),name:"ICSE vacation",parentId:parent.id,target:target("board"),rule:range("2026-11-01","2026-11-03")});expect(get().status).toBe("holiday");const other=c.boards[1];expect(resolve(other,other.grades[0].classrooms[0].id,"2026-11-04",c).status).toBe("working");expect(schedulingIssues(c,"2026-11-01","2027-03-31")).toEqual([]);
 });
 it("converts weekly board closures to directly overridable holiday families",()=>{
  const {c,b,room,schedule}=fixture();b.nonWorkingDays=[0];const adopted=adoptScheduling(c,id),board=adopted.boards[0];expect(board.nonWorkingDays).toEqual([]);const sunday=board.events.find(e=>e.rule.type==="weekly")!;expect(sunday.configurationPart).toBe("default-holidays");
  board.events.push({...sunday,id:id(),name:"Class Monday off instead",parentId:sunday.id,target:target("classrooms",room.id),rule:{type:"weekly",weekdays:[1],intervalWeeks:1}});
  expect(resolve(board,room.id,"2026-11-08",adopted).status).toBe("working");expect(resolve(board,room.id,"2026-11-09",adopted).status).toBe("holiday");expect(resolve(board,board.grades[0].classrooms[1].id,"2026-11-08",adopted).status).toBe("holiday");expect(c.boards[0].nonWorkingDays).toEqual([0]);expect(calendarSummary(adopted,"2026-11-01","2026-11-30",board.id).rows[0].regularWeeklyWorkingDays).toBe(6);
 });
 it("unified timing-only events apply complete schedules without opening advanced holidays",()=>{
  const {b,get,schedule,room}=fixture();const template={...schedule(target("school"),"Special timing"),templateOnly:true};b.schedules.push(template);const timing={id:id(),name:"Wednesday timing",kind:"working" as const,operation:"timing" as const,configurationPart:"advanced" as const,scheduleId:template.id,target:target("classrooms",room.id),rule:{type:"weekly" as const,weekdays:[3],intervalWeeks:1}};b.events.push(timing);expect(get().schedule?.name).toBe("Special timing");
  b.events.push({id:id(),name:"Advanced closure",kind:"holiday",configurationPart:"advanced",target:target("school"),rule:defaultRule});expect(get().status).toBe("holiday");
 });
 it("explicit timing children replace parent timing without losing unrelated calendar rules",()=>{
  const {b,get,schedule,room,c}=fixture();const a={...schedule(target("school"),"Parent timing"),templateOnly:true},child={...schedule(target("school"),"Child timing"),templateOnly:true};b.schedules.push(a,child);const parent={id:id(),name:"Parent timing rule",kind:"working" as const,operation:"timing" as const,configurationPart:"advanced" as const,scheduleId:a.id,target:target("school"),rule:{...defaultRule,type:"date" as const,date:"2026-11-04"}};b.events.push(parent,{...parent,id:id(),name:"Child timing rule",parentId:parent.id,scheduleId:child.id,target:target("classrooms",room.id),rule:{type:"weekly",weekdays:[3],intervalWeeks:1}});expect(get().schedule?.name).toBe("Child timing");expect(schedulingIssues(c,"2026-11-01","2027-03-31")).toEqual([]);
 });
 it("rejects timing rules without templates and cross-kind parent replacement",()=>{
  const {b,c,room}=fixture();const parent={id:id(),name:"Holiday parent",kind:"holiday" as const,configurationPart:"advanced" as const,target:target("school"),rule:defaultRule};b.events.push(parent,{id:id(),name:"Invalid timing",kind:"working",operation:"timing",configurationPart:"advanced",parentId:parent.id,target:target("classrooms",room.id),rule:defaultRule});const issues=schedulingIssues(c,"2026-11-01","2027-03-31").join();expect(issues).toMatch(/complete bell schedule/);expect(issues).toMatch(/cannot replace calendar-status/);
 });
 it("full working children cancel broader timing-only half templates when inheriting defaults",()=>{
  const {b,get,schedule,room}=fixture();const template={...schedule(target("school"),"Broad half timing",defaultRule,true),templateOnly:true};b.schedules.push(template);b.events.push({id:id(),name:"Broad timing",kind:"working",operation:"timing",configurationPart:"advanced",scheduleId:template.id,target:target("school"),rule:{type:"weekly",weekdays:[3],intervalWeeks:1}},{id:id(),name:"Class full working",kind:"working",configurationPart:"advanced",target:target("classrooms",room.id),rule:{type:"weekly",weekdays:[3],intervalWeeks:1}});expect(get().status).toBe("working");expect(get().schedule?.name).toBe("Normal");
 });
 it("copy preserves resolver and drops descendants of excluded parents",()=>{
  const {b,c}=fixture();const parent={id:id(),name:"Fixed",kind:"holiday" as const,configurationPart:"default-holidays" as const,target:target("school"),rule:{...defaultRule,type:"date" as const,date:"2026-11-04"}};b.events.push(parent,{...parent,id:id(),parentId:parent.id,target:target("sections",b.sections[0].id),rule:defaultRule});const copy=copyYear(c);expect(copy.resolverVersion).toBe(2);expect(copy.boards[0].events).toEqual([]);expect(b.events).toHaveLength(2);
 });
 it("deleted parent or template blocks publishing until dependents are repaired",()=>{
  const {b,c}=fixture();const parent={id:id(),name:"Parent",kind:"holiday" as const,target:target("school"),rule:defaultRule};b.events.push(parent,{...parent,id:id(),parentId:parent.id,target:target("sections",b.sections[0].id)});const removed=removeFromConfig(c,b.id,"event",parent.id);expect(review(removed,100,"2026-11-04","2026-11-04").some(i=>i.severity==="error"&&/parent/.test(i.message))).toBe(true);
 });
});
