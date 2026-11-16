"use client";
import {useState,useEffect,useRef} from "react";
import type {Board,Config,Schedule,Rule} from "../../../../packages/domain/src";
import {api} from "../../lib/api";
import {Button} from "../../components/ui";
export function EffectiveRulePreview({yearId,board,boards,entry,kind,resolverVersion}:{resolverVersion?:1|2;yearId:string;board:Board;boards:Board[];entry:Schedule|Board["events"][number];kind:"schedules"|"events"}) {
  const [previewBoard,setPreviewBoard]=useState(board.id);
  const generation=useRef(0);
  const [result,setResult]=useState<any[]|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const inputs=JSON.stringify([entry,boards,resolverVersion]);
  useEffect(()=>{generation.current++;setResult(null);setBusy(false);setError("");},[inputs,previewBoard]);
  async function preview() {
    const request=++generation.current;
    setBusy(true);setError("");setResult(null);
    try {
      const config:Config={resolverVersion,boards:boards.map(b=>({...b,[kind]:b.id===board.id?[...b[kind].filter(r=>r.id!==entry.id),entry]:b[kind].filter(r=>r.id!==entry.id)}))};
      const next=config.boards.find(b=>b.id===previewBoard)!;
      const patterns:Rule[]=[entry.rule];
      // Include ancestor dates so shortening a vacation previews reopened dates,
      // not just dates which remain closed under the child rule.
      let parentId="parentId" in entry ? entry.parentId : undefined;
      const seen=new Set<string>([entry.id]);
      while(parentId && !seen.has(parentId)) {
        seen.add(parentId);
        const parent=boards.flatMap(b=>b.events).find(e=>e.id===parentId);
        if(!parent)break;
        patterns.push(parent.rule);parentId=parent.parentId;
      }
      const matching=await Promise.all(patterns.map(rule=>api(`/years/${yearId}/rule-preview`,"POST",{rule})));
      if(request!==generation.current)return;
      const dates=[...new Set<string>(matching.flatMap(r=>r.dates))].sort();
      if(!dates.length){setResult([]);return;}
      // Both boundaries remain visible for long ranges; monthly preview remains
      // available for inspecting every intermediate date.
      const sample=dates.length>12?[...dates.slice(0,6),...dates.slice(-6)]:dates;
      const resolved=await api(`/years/${yearId}/preview`,"POST",{board:next,config,dates:sample});
      if(request===generation.current)setResult(resolved);
    }catch(e){if(request===generation.current)setError((e as Error).message);}
    finally{if(request===generation.current)setBusy(false);}
  }
  return <section className="effective-rule-preview">
    <label>Preview board<select value={previewBoard} onChange={e=>setPreviewBoard(e.target.value)}>{boards.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    <Button disabled={busy} onClick={()=>void preview()}>{busy?"Resolving…":"Effective Calendar Preview"}</Button>
    <p className="form-help">Shows up to 12 dates from this rule and its parent rules, including both ends of long ranges. Shortened vacations include dates reopened by the override. Use Calendar & preview to inspect other dates.</p>
    {error&&<p role="alert" className="notice error">{error}</p>}
    {result&&<div className="table-scroll"><table className="portal-table"><thead><tr><th>Date</th><th>Effective status</th><th>Winning rules / conflicts</th></tr></thead><tbody>{result.map(r=><tr key={r.date}><td>{r.date}</td><td>{r.status}</td><td>{r.results.map((c:any)=>`${c.classroomName || c.classroomId}: ${c.reason}`).join("; ")}</td></tr>)}</tbody></table>{!result.length&&<p>No matching dates in this academic year.</p>}</div>}
  </section>;
}
