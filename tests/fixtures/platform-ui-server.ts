/** Development-only UI review proxy. Never imported by the application.
 * Uses synthetic records and the real frontend, without connecting to a database.
 * Run after starting the web app: npx tsx tests/fixtures/platform-ui-server.ts
 */
import {createServer,request as proxyRequest} from "node:http";
import {randomUUID as uuid} from "node:crypto";
import {emptyConfig,configSchema,review,recurrenceDates,resolve} from "../../packages/domain/src";
import {adoptScheduling} from "../../packages/domain/src/scheduling";
import {calendarDay,calendarSummary,selectedClassrooms,defaultPlatformSettings,configurationChanges} from "../../packages/domain/src/enhancements";
import {configurationImpact} from "../../packages/domain/src/impact";
import {effectiveImpact,classroomCounts} from "../../packages/domain/src/refinement";
const target=new URL(process.env.PLAN_UI_TARGET || "http://127.0.0.1:3302");
if(!["localhost","127.0.0.1"].includes(target.hostname))throw Error("UI review target must be local");
const port=Number(process.env.PLAN_UI_PREVIEW_PORT || 3303),origin=`http://127.0.0.1:${port}`;
const orgId=uuid(),secondOrg=uuid(),schoolId=uuid(),yearId=uuid(),revisionId=uuid(),publishedId=uuid();
const now="2026-11-16T08:00:00.000Z",startsAt="2026-04-01T00:00:00.000Z",endsAt="2027-03-31T00:00:00.000Z";
const admin={id:uuid(),name:"UI Review Administrator",email:"preview-admin@example.test",role:"PLATFORM_ADMIN",mustChangePassword:false};
const orgUser={...admin,id:uuid(),role:"ORG_ADMIN",organizationId:orgId,organizationName:"Cedar Learning Trust · UI Preview"};
const organizations=[{id:orgId,name:orgUser.organizationName,legalName:"Cedar Learning Trust",type:"Education trust",registration:"UI-TEST-001",contactName:"Preview Administrator",email:"preview-admin@example.test",phone:"0000000000",address:"Synthetic UI review address",city:"Pune",state:"Maharashtra",postalCode:"411001",status:"ACTIVE",createdAt:now,updatedAt:now,activatedAt:now,onboardingStep:7,completedSteps:[1,2,3,4,5,6,7],users:[orgUser],_count:{institutions:1}},{id:secondOrg,name:"Westfield Education · UI Preview",legalName:"Westfield Education",type:"Society",email:"westfield@example.test",contactName:"Preview Administrator",phone:"0000000000",status:"ONBOARDING",createdAt:now,updatedAt:now,onboardingStep:4,completedSteps:[1,2,3],_count:{institutions:0}}];
let config=adoptScheduling(emptyConfig(["CBSE","ICSE"],uuid),uuid);
for(const b of config.boards){const section={id:uuid(),name:"Primary"};b.sections=[section,{id:uuid(),name:"Secondary"}];b.grades=[{id:uuid(),name:"Grade 4",active:true,sectionId:section.id,classrooms:[{id:uuid(),name:"4A",active:true,capacity:35},{id:uuid(),name:"4B",active:true,capacity:35}]}];}
const [cbse,icse]=config.boards;
const normal={id:uuid(),name:"Regular school day",arrival:480,dispersal:780,dayType:"full" as const,target:{scope:"school" as const,ids:[]},rule:{type:"default" as const,weekdays:[],intervalWeeks:1},slots:[{id:uuid(),name:"Assembly",kind:"routine" as const,start:480,end:495},{id:uuid(),name:"Period 1",kind:"period" as const,start:495,end:555},{id:uuid(),name:"Period 2",kind:"period" as const,start:555,end:615},{id:uuid(),name:"Break",kind:"routine" as const,start:615,end:630},{id:uuid(),name:"Period 3",kind:"period" as const,start:630,end:690},{id:uuid(),name:"Lunch",kind:"routine" as const,start:690,end:720},{id:uuid(),name:"Period 4",kind:"period" as const,start:720,end:780}]};
cbse.schedules=[normal];
const vacation={id:uuid(),name:"Diwali vacation",kind:"holiday" as const,configurationPart:"default-holidays" as const,target:{scope:"school" as const,ids:[]},rule:{type:"recurring" as const,weekdays:[0,1,2,3,4,5,6],intervalWeeks:1,startsOn:"2026-11-01",endsOn:"2026-11-05"}};
cbse.events.push(vacation,{...vacation,id:uuid(),name:"Primary vacation override",parentId:vacation.id,target:{scope:"sections",ids:[cbse.sections[0].id]},rule:{...vacation.rule,endsOn:"2026-11-03"}});
cbse.events.push({id:uuid(),name:"Fourth Saturday closure",kind:"holiday",configurationPart:"advanced",target:{scope:"board",ids:[]},rule:{type:"recurring",weekdays:[6],nth:4,intervalWeeks:1}});
const published=structuredClone(config);
const year={id:yearId,label:"2026–27",startsAt,endsAt,draftRevisionId:revisionId,publishedRevisionId:publishedId,publishedRevision:{id:publishedId,sequence:1,status:"ACTIVE",warnings:[],publishedAt:now},draftRevision:{id:revisionId,sequence:2,lock:0}};
const school={id:schoolId,organizationId:orgId,name:"Cedar Grove School · UI Preview",registration:"UI-SCHOOL-001",boards:["CBSE","ICSE"],logo:`${origin}/__preview/logo.svg`,officer:"Preview School Administrator",email:"school@example.test",phone:"0000000000",address:"Synthetic school address, Pune",status:"ACTIVE",createdAt:now,updatedAt:now,years:[year],organization:organizations[0]};
const subscription={id:uuid(),organizationId:orgId,reference:"UI-PREVIEW-2026",amount:48000,classroomLimit:60,userLimit:1,status:"ACTIVE",agreementStatus:"SIGNED",paymentStatus:"PAID",startsAt,endsAt,organization:organizations[0]};
const license={organizationId:orgId,used:4,limit:60,users:1,userLimit:1,contractId:subscription.id,contractConflict:false,overLimit:false,institutions:[{institutionId:schoolId,used:4,years:[{yearId,published:4,draft:4}]}]};
const requests=[{id:uuid(),organizationId:orgId,institutionId:schoolId,organization:organizations[0],institution:school,reason:"Update the school contact address",status:"PENDING",proposed:{address:"Updated synthetic address"},resolution:"",createdAt:now}];
const titles=["Organization","Schools","Subscription","Agreement & payment","Administrator","Activate client","Client workspace"];
const onboarding=organizations.map(o=>({...o,progress:Math.round(o.completedSteps.length/7*100),currentStep:o.onboardingStep,blockingIssues:o.status==="ACTIVE"?[]:["Record the signed agreement and payment"],checklist:titles.map((title,n)=>({step:n+1,title,complete:o.completedSteps.includes(n+1),blockers:o.completedSteps.includes(n+1)?[]:["Complete the saved registration details"]}))}));
const audit=[{id:uuid(),organizationId:orgId,actorId:admin.id,entityId:yearId,action:"structure.published",createdAt:now,detail:{},schoolId,schoolName:school.name,yearId,yearLabel:year.label}];
const settings={id:"platform",lock:0,values:defaultPlatformSettings};
let lock=0;
function record(){return {year,revision:{id:revisionId,sequence:2,status:"DRAFT",lock,summary:"UI preview working draft"},config,published,license};}
function clientSchool(){return {school,year,status:"DRAFT_CHANGES_PENDING",basis:"Working draft · synthetic UI review data",counts:classroomCounts(config),hasGrades:true,hasCalendar:true,readiness:"Configured",history:[{id:publishedId,sequence:1,status:"ACTIVE",summary:"Preview publication",publishedAt:now}],calendar:calendarSummary(config,"2026-04-01","2027-03-31"),boards:config.boards.map(b=>({id:b.id,name:b.name,sections:b.sections.length,sectionNames:b.sections.map(s=>s.name),grades:b.grades.length,gradeRows:b.grades.map(g=>({...g,section:b.sections.find(s=>s.id===g.sectionId)?.name})),activeGrades:b.grades.length,classrooms:2,activeClassrooms:2,defaultSchedules:b.schedules.filter(s=>s.rule.type==="default").length,advancedSchedules:b.schedules.filter(s=>s.rule.type!=="default").length,calendarRules:b.events.length,weeklyOffDays:1}))};}
function directory(url:URL){const term=(url.searchParams.get("search")||"").toLowerCase();const row={...school,yearId,yearLabel:year.label,structureStatus:"DRAFT_CHANGES_PENDING",classroomCount:4,operationallyActiveClassrooms:4,lastUpdated:now};const rows=row.name.toLowerCase().includes(term)?[row]:[];return {metrics:{total:1,configured:1,inProgress:0,pending:1,totalClassrooms:4,activeClassroomFlags:4,operationallyActiveClassrooms:4,NOT_STARTED:0,DRAFT:0,INCOMPLETE_ACTIVE:0,ACTIVE:0,DRAFT_CHANGES_PENDING:1,EDITING_DRAFT_NO_CHANGES:0},total:rows.length,rows,page:1,pageSize:12,boards:school.boards,license,subscriptions:[subscription],contract:subscription,activity:audit,attention:[row]};}
const server=createServer(async(req,res)=>{
  const url=new URL(req.url || "/",origin),path=url.pathname,mode=req.headers.cookie?.includes("plan_ui_preview=organization")?"organization":"platform";
  function json(value:unknown,status=200){res.writeHead(status,{"Content-Type":"application/json","X-PLAN-UI-Preview":"synthetic-data-no-database"});res.end(JSON.stringify(value));}
  if(path==="/__preview"){res.writeHead(200,{"Content-Type":"text/html"});res.end(`<html><body style="font:16px system-ui;padding:40px"><h1>PLAN UI review</h1><p>Real application UI with synthetic API fixtures. No database connection.</p><p><a href="/__preview/platform">Open platform preview</a></p><p><a href="/__preview/organization">Open organization preview</a></p></body></html>`);return;}
  if(path==="/__preview/platform" || path==="/__preview/organization"){res.writeHead(302,{"Set-Cookie":`plan_ui_preview=${path.endsWith("organization")?"organization":"platform"}; Path=/; SameSite=Lax`,Location:path.endsWith("organization")?"/?page=Overview":"/?page=Dashboard"});res.end();return;}
  if(path==="/__preview/logo.svg"){res.writeHead(200,{"Content-Type":"image/svg+xml"});res.end('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#effaf7"/><path d="M20 35L40 22 60 35V60H20Z" fill="none" stroke="#0f766e" stroke-width="4"/><path d="M34 60V44H46V60" fill="none" stroke="#0f766e" stroke-width="4"/></svg>');return;}
  if(path.startsWith("/api/")){
    try{
      let raw="";for await(const chunk of req)raw+=chunk;
      const body=raw?JSON.parse(raw):{},method=req.method || "GET";
      if(path==="/api/auth/me"){json({csrf:"ui-preview-only",user:mode==="organization"?orgUser:admin});return;}
      const map:Record<string,unknown>={"/api/organizations":organizations,"/api/institutions":[school],"/api/subscriptions":[subscription],"/api/requests":requests,"/api/usage":[license],"/api/audit":audit,"/api/onboarding":onboarding,"/api/settings":settings,"/api/workspace-settings":{...defaultPlatformSettings,maintenanceNotice:"UI review · Synthetic records · No live database"},"/api/organization-profile":{...organizations[0],subscriptions:[subscription],license},"/api/dashboard":{total:2,active:1,onboarding:1,inactive:0,recent:onboarding}};
      if(path==="/api/client-portal"){json(directory(url));return;}
      if(path===`/api/institutions/${schoolId}/portal`){json(clientSchool());return;}
      if(path===`/api/institutions/${schoolId}/years`){json([year]);return;}
      if(path.startsWith(`/api/years/${yearId}/`)){
        const action=path.split("/").pop();
        if(action==="config"){
          if(method==="PUT"){config=configSchema.parse(body.config);lock++;json({lock,savedAt:now,license});}else json(record());return;
        }
        if(action==="history"){json(clientSchool().history);return;}
        if(action==="rule-preview"){const dates=recurrenceDates(body.rule,"2026-04-01","2027-03-31");json({dates,count:dates.length,start:"2026-04-01",end:"2027-03-31"});return;}
        const proposed=body.config?configSchema.parse(body.config):config;
        if(action==="preview"){const b=body.board || proposed.boards[0];json(body.dates.map((date:string)=>({date,...calendarDay(b,selectedClassrooms(b,body.filter || {}),date,proposed)})));return;}
        if(action==="calendar-summary"){json(calendarSummary(proposed,"2026-04-01","2027-03-31",body.boardId,body.filter || {}));return;}
        if(action==="review"){json({issues:review(config,60,"2026-04-01","2027-03-31"),changes:configurationChanges(published,config),impact:configurationImpact(published,config),classrooms:4,license});return;}
        if(action==="impact"){json({...configurationImpact(config,proposed),effective:effectiveImpact(config,proposed,"2026-04-01","2027-03-31")});return;}
      }
      if(path==="/api/auth/logout"){json({ok:true});return;}
      if(method==="GET" && path in map){json(map[path]);return;}
      json({message:"UI preview does not write live records. This operation requires the real API."},409);return;
    }catch(error){json({message:(error as Error).message},400);return;}
  }
  const upstream=proxyRequest(new URL(req.url || "/",target),{method:req.method,headers:req.headers},response=>{res.writeHead(response.statusCode || 500,response.headers);response.pipe(res);});
  upstream.on("error",()=>{res.writeHead(502);res.end("Start the local Next application before the UI review proxy.");});req.pipe(upstream);
});
server.listen(port,"127.0.0.1",()=>console.log(`UI-only review proxy: ${origin}/__preview (synthetic fixtures; no database)`));
