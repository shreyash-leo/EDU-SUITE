import { autoAssign, resolve, type Config, type Schedule, type Slot, type Rule } from "./index";

/** Bounded deterministic bin packing; a period is never split or resized. */
export function assistedAssign(arrival: number, dispersal: number, periods: Slot[], routines: Slot[], maxStates = 50000): Slot[] {
  if (!periods.length || periods.length > 30 || periods.some(p => p.kind !== "period" || !Number.isInteger(p.end-p.start) || p.end <= p.start)) throw Error("Supply 1–30 periods with positive integer durations");
  const anchors = [...routines].sort((a,b)=>a.start-b.start);
  if (anchors.some((r,n)=>r.end<=r.start || r.start<arrival || r.end>dispersal || n>0 && r.start<anchors[n-1].end)) throw Error("Fixed routines overlap or lie outside the school day");
  const capacities: number[] = []; let cursor=arrival;
  for (const r of [...anchors, {start:dispersal,end:dispersal}]) { capacities.push(r.start-cursor); cursor=r.end; }
  const durations=periods.map(p=>p.end-p.start);
  const available=capacities.reduce((a,b)=>a+b,0), required=durations.reduce((a,b)=>a+b,0);
  if (required!==available) throw Error(required>available ? `${required-available} excess teaching minutes` : `${available-required} minutes are uncovered`);
  let states=0, exhausted=false; const failed=new Set<string>();
  function search(mask:bigint, bin:number, left:number):number[]|null {
    if (++states>maxStates) { exhausted=true; return null; }
    if (bin===capacities.length) return mask===0n ? [] : null;
    if (!left) return search(mask,bin+1,capacities[bin+1]||0);
    const key=`${mask}:${bin}:${left}`; if(failed.has(key)) return null;
    const tried=new Set<number>();
    for(let n=0;n<periods.length;n++) {
      const bit=1n<<BigInt(n), d=durations[n];
      if (!(mask&bit) || d>left || tried.has(d)) continue;
      tried.add(d); const tail=search(mask^bit,bin,left-d);
      if(tail) return [n,...tail]; if(exhausted) break;
    }
    failed.add(key); return null;
  }
  const order=search((1n<<BigInt(periods.length))-1n,0,capacities[0]);
  if(!order) throw Error(exhausted ? "Arrangement search reached its safe limit. Adjust durations or arrange manually." : "No whole-period arrangement fits the fixed routine boundaries");
  let next=0; const slots=autoAssign(arrival,dispersal,order.map(n=>durations[n]),anchors,()=>`generated-${next++}`);
  let index=0;
  return slots.map(slot=>slot.kind==="routine" ? slot : {...periods[order[index++]],start:slot.start,end:slot.end});
}
export function copyRuleClassification(rule: Rule) {
  return rule.type==="date" ? "fixed-date" : rule.startsOn || rule.endsOn ? "date-bounded" : rule.intervalWeeks>1 ? "anchor-review" : "safe-recurring";
}
export function classroomCounts(config: Config) {
  const grades=config.boards.flatMap(b=>b.grades), rooms=grades.flatMap(g=>g.classrooms);
  const activeFlags=rooms.filter(c=>c.active).length;
  return {total:rooms.length,activeFlags,operationallyActive:grades.filter(g=>g.active).flatMap(g=>g.classrooms).filter(c=>c.active).length,inactive:rooms.length-activeFlags,licensed:rooms.length};
}
/** Exact effective comparison, deliberately bounded by the academic-year date range. */
export function effectiveImpact(before: Config|null, after: Config, start:string,end:string) {
  const dates: {date:string; classrooms:string[]}[]=[];
  const ids=new Set([...(before?.boards||[]),...after.boards].flatMap(b=>b.grades.flatMap(g=>g.classrooms.map(c=>c.id))));
  const signature=(config:Config|null,id:string,date:string)=>{
    const b=config?.boards.find(b=>b.grades.some(g=>g.classrooms.some(c=>c.id===id)));
    if(!b || !config)return "absent";
    const r=resolve(b,id,date,config);
    return JSON.stringify([r.status,r.schedule?.id,r.schedule?.dayType,r.schedule?.arrival,r.schedule?.dispersal,r.schedule?.slots.map(s=>[s.id,s.kind,s.start,s.end])]);
  };
  for(let t=Date.parse(start);t<=Date.parse(end);t+=86400000){const date=new Date(t).toISOString().slice(0,10);const classrooms=[...ids].filter(id=>signature(before,id,date)!==signature(after,id,date));if(classrooms.length)dates.push({date,classrooms});}
  return {changedDates:dates.length,classroomDates:dates.reduce((n,d)=>n+d.classrooms.length,0),dates,historicalRecordsPreserved:true};
}
export function duplicateTemplates(schedules:Schedule[]) {
  const groups=new Map<string,string[]>();
  for(const s of schedules){const key=JSON.stringify([s.arrival,s.dispersal,s.dayType||"full",s.slots.map(p=>[p.name,p.kind,p.start,p.end])]);groups.set(key,[...(groups.get(key)||[]),s.id]);}
  return [...groups.values()].filter(ids=>ids.length>1);
}
