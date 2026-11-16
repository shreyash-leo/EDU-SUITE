"use client";
import {useEffect,useState} from "react";
import type {Config} from "../../../../packages/domain/src";
import {api,type RecordData} from "../../lib/api";
import {DataTable} from "../../components/ui";
/** Uses the same server-side resolver as publication, with stale requests ignored. */
export function ReviewCalendar({yearId,config,start,end}:{yearId:string;config:Config;start:string;end:string}) {
  const rooms=config.boards.flatMap(b=>b.grades.flatMap(g=>g.classrooms.filter(c=>c.active&&g.active).map(c=>({id:c.id,name:`${b.name} / ${g.name} / ${c.name}`,board:b}))));
  const [room,setRoom]=useState(rooms[0]?.id || ""),[date,setDate]=useState(start);
  const [summary,setSummary]=useState<RecordData|null>(null),[preview,setPreview]=useState<RecordData|null>(null);
  const [summaryError,setSummaryError]=useState(""),[previewError,setPreviewError]=useState(""),[previewLoading,setPreviewLoading]=useState(false);
  useEffect(()=>{
    let current=true;setSummary(null);setSummaryError("");
    void api(`/years/${yearId}/calendar-summary`,"POST",{config}).then(value=>{if(current)setSummary(value)}).catch(error=>{if(current)setSummaryError(error.message)});
    return()=>{current=false};
  },[yearId,config]);
  useEffect(()=>{
    let current=true;setPreview(null);setPreviewError("");setPreviewLoading(false);
    const selected=rooms.find(r=>r.id===room);
    if(!selected)return;
    if(!date || date<start || date>end){setPreviewError("Choose a date within this academic year.");return;}
    setPreviewLoading(true);
    void api(`/years/${yearId}/preview`,"POST",{board:selected.board,config,dates:[date],filter:{classroomId:room}}).then(value=>{if(current)setPreview(value[0]?.results[0] || null)}).catch(error=>{if(current)setPreviewError(error.message)}).finally(()=>{if(current)setPreviewLoading(false)});
    return()=>{current=false};
  },[yearId,config,room,date,start,end]);
  return <section className="review-calendar">
    <h3>Calendar readiness</h3><p className="form-help">Default Holidays take priority over Advanced Scheduling and normal bell timing. Totals are calculated separately for each operational classroom.</p>
    {summaryError&&<div className="notice error" role="alert">{summaryError}</div>}
    {!summary&&!summaryError&&<p role="status">Calculating calendar readiness…</p>}
    {summary&&<DataTable data={summary.rows} emptyTitle="No operational classrooms" emptyText="Add an active grade and classroom to review calendar readiness." columns={[{accessorKey:"board",header:"Board"},{accessorKey:"classroom",header:"Classroom"},{accessorKey:"workingDays",header:"Working dates"},{accessorKey:"holidays",header:"Closed dates"},{accessorKey:"halfDays",header:"Half-days"},{accessorKey:"instructionalMinutes",header:"Teaching minutes"},{accessorKey:"unresolvedDays",header:"Unresolved dates"}]}/>}
    <div className="form-grid"><label>Inspect classroom<select value={room} onChange={e=>setRoom(e.target.value)}>{!rooms.length&&<option value="">No operational classrooms</option>}{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>Inspect date<input type="date" min={start} max={end} value={date} onChange={e=>setDate(e.target.value)}/></label></div>
    {previewLoading&&<p role="status">Resolving classroom date…</p>}
    {previewError&&<div className="notice error" role="alert">{previewError}</div>}
    {preview&&<div className={`notice ${["invalid","conflict","missing"].includes(preview.status)?"error":""}`}><strong>{preview.status}</strong><span>{preview.reason}</span></div>}
  </section>;
}
