"use client";
import {useState} from "react";
import type {Config} from "../../../../packages/domain/src";
import {api} from "../../lib/api";
import {Button} from "../../components/ui";
export function EffectiveChangePreview({yearId,config,lock,revisionId}:{yearId:string;config:Config;lock:number;revisionId:string}){
 const [result,setResult]=useState<{changedDates:number;classroomDates:number}|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 return <div className="effective-change-preview"><Button disabled={busy} onClick={()=>{setBusy(true);setResult(null);setError("");void api(`/years/${yearId}/impact`,"POST",{config,lock,revisionId}).then(r=>setResult(r.effective)).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>{busy?"Calculating…":"Calculate effective before/after impact"}</Button>{result&&<p className="notice">{result.changedDates} dates · {result.classroomDates} classroom/date combinations change across this academic year. Historical publications remain unchanged.</p>}{error&&<p role="alert" className="notice error">{error}</p>}</div>;
}
