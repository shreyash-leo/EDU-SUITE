import {resolve,validDate,type Config} from "./index";
import {calendarSummary} from "./enhancements";
import {classroomCounts} from "./refinement";
export type PublishedContext = {organizationId:string;schoolId:string;academicYearId:string;publishedRevisionId:string;academicYearStart:string;academicYearEnd:string};
/** Pure, versioned read model. Caller must supply a persisted publication, never a draft. */
export function publishedOutput(config:Config,context:PublishedContext,start:string,end:string,classroomId?:string){
 if(!validDate(start)||!validDate(end)||start>end||start<context.academicYearStart||end>context.academicYearEnd)throw Error("Output dates must be ordered and within the academic year");
 const boards=config.boards.map(b=>({id:b.id,name:b.name,sections:b.sections.map(s=>({...s})),grades:b.grades.map(g=>({id:g.id,name:g.name,active:g.active,sectionId:g.sectionId,classrooms:g.classrooms.filter(c=>!classroomId||c.id===classroomId).map(c=>{
  const dates=[];
  for(let t=Date.parse(start);t<=Date.parse(end);t+=86400000){const date=new Date(t).toISOString().slice(0,10),r=resolve(b,c.id,date,config);const teachingPeriods=r.status==="working"?r.schedule!.slots.filter(s=>s.kind==="period").map(s=>({id:s.id,start:s.start,end:s.end})):[];
   dates.push({date,status:r.status,dayType:r.status==="working"?r.schedule!.dayType||"full":null,holiday:r.status==="holiday",halfDay:r.status==="working"&&r.schedule?.dayType==="half",scheduleId:r.status==="working"?r.schedule!.id:null,reason:r.reason,calendarRuleId:r.calendarRuleId||null,winningRule:r.winningRule||null,warnings:r.warnings||[],conflicts:r.conflicts||[],provisional:r.status==="missing",unresolved:["missing","invalid","conflict"].includes(r.status),teachingPeriods,instructionalMinutes:teachingPeriods.reduce((n,p)=>n+p.end-p.start,0)});
  }
  return {...c,operationallyActive:g.active&&c.active,dates};
 })}))}));
 const summarize=(from:string,to:string)=>{const value=calendarSummary(config,from,to,undefined,classroomId?{classroomId}:{});return {...value,rows:value.rows.map(({classifications,holidayDates,...row})=>row)};};
 return {contractVersion:1 as const,resolverVersion:config.resolverVersion || 1,...context,start,end,counts:classroomCounts(config),summary:summarize(start,end),academicYearSummary:summarize(context.academicYearStart,context.academicYearEnd),boards,schedules:config.boards.flatMap(b=>b.schedules.map(s=>({...s,ownerBoardId:b.id}))),readOnly:true as const};
}
