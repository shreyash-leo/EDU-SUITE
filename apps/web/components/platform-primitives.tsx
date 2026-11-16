"use client";
import React from "react";
import {ArrowRight, Building2, School, Receipt, Route, ClipboardCheck} from "lucide-react";
import type {Tone} from "../lib/design-system";
import type {RecordData} from "../lib/api";

export function SectionIntro({eyebrow,title,description,action,tone="brand"}:{eyebrow?:string;title:string;description?:string;action?:React.ReactNode;tone?:Tone}) {
  return <header className="section-intro" data-tone={tone}><div>{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2>{description&&<p>{description}</p>}</div>{action&&<div className="row-actions">{action}</div>}</header>;
}

export function WorkspaceSkeleton({label="Loading workspace",rows=4}:{label?:string;rows?:number}) {
  return <section className="workspace-skeleton" role="status" aria-label={label} aria-busy="true"><span className="sr-only">{label}…</span><div className="skeleton skeleton-title"/>{Array.from({length:rows},(_,n)=><div className="skeleton skeleton-row" key={n}/>)}</section>;
}

/** All values come from existing platform records; no sample analytics. */
export function PlatformOperations({institutions,subscriptions,requests,onboarding,onPage,onOnboarding}:{institutions:RecordData[];subscriptions:RecordData[];requests:RecordData[];onboarding:RecordData[];onPage:(page:string)=>void;onOnboarding:(id:string)=>void}) {
  const pending=requests.filter(row=>row.status==="PENDING");
  const queue=onboarding.filter(row=>row.progress<100 && row.status!=="INACTIVE").slice(0,4);
  return <section className="platform-operations" aria-label="Platform operations">
    <div className="operations-strip">
      {[{name:"Registered schools",value:institutions.length,Icon:School,page:"Schools",tone:"teal"},{name:"Recorded subscriptions",value:subscriptions.length,Icon:Receipt,page:"Subscriptions",tone:"advanced"},{name:"Requests awaiting review",value:pending.length,Icon:ClipboardCheck,page:"Requests & Settings",tone:"warning"}].map(item=><button key={item.name} data-tone={item.tone} onClick={()=>onPage(item.page)}><span className="semantic-icon"><item.Icon size={18}/></span><span><small>{item.name}</small><strong>{item.value}</strong></span><ArrowRight size={16}/></button>)}
    </div>
    <div className="operations-worklist"><SectionIntro title="Continue client setup" description="Organizations with onboarding still in progress." tone="info" action={<button className="record-link" onClick={()=>onPage("Onboarding")}>All onboarding <ArrowRight size={14}/></button>}/>
      {queue.length ? <ul>{queue.map(row=><li key={row.id}><span className="semantic-icon" data-tone="info"><Building2 size={18}/></span><div><strong>{row.name}</strong><small>{row.blockingIssues?.[0] || `${row.progress}% complete · Continue the saved onboarding steps`}</small></div><progress aria-label={`${row.name} onboarding progress`} value={row.progress} max={100}/><button className="button" onClick={()=>onOnboarding(row.id)}>Continue <ArrowRight size={14}/></button></li>)}</ul>:<div className="quiet-empty"><Route size={19}/><p>No unfinished onboarding records. New organizations will appear here.</p></div>}
    </div>
  </section>;
}
