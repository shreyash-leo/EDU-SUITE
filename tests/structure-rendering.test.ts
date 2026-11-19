import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,it,expect} from "vitest";
import {randomUUID as id} from "node:crypto";
import {ScheduleWizard} from "../apps/web/features/structure/schedule-wizard";
import {BellCalendar} from "../apps/web/features/structure/calendar";
import {NavigationProvider} from "../apps/web/lib/navigation";
import {emptyConfig,type Config} from "../packages/domain/src";
function fixture() {
 const config:Config={...emptyConfig(["CBSE"],id),resolverVersion:2},board=config.boards[0];board.nonWorkingDays=[];
 const section={id:id(),name:"Primary"},room={id:id(),name:"4A",active:true};board.sections=[section];board.grades=[{id:id(),name:"Grade 4",active:true,sectionId:section.id,classrooms:[room]}];
 const render=(view:string,editable=true)=>renderToStaticMarkup(React.createElement(NavigationProvider,null,React.createElement(BellCalendar,{board,config,editable,initialView:view,year:{id:id(),startsAt:"2026-11-01",endsAt:"2027-03-31"},onChange:()=>{},onAdopt:()=>{},onApply:()=>{},onEdit:()=>{},onDelete:()=>{}})));
 return {config,board,room,render};
}
describe("Structure Management server rendering",()=>{
 it("shows three configuration parts, effective preview and direct apply action",()=>{
  const {render}=fixture(),html=render("Default Bell Time");for(const name of ["Default Bell Timing","Default Holidays","Advanced Scheduling","Calendar &amp; preview","Save &amp; apply"])expect(html).toContain(name);
 });
 it("shows holiday families and direct weekly-holiday creation without working-day setup",()=>{
  const {board,room,render}=fixture(),parent={id:id(),name:"Diwali Vacation",kind:"holiday" as const,configurationPart:"default-holidays" as const,target:{scope:"school" as const,ids:[]},rule:{type:"date" as const,date:"2026-11-04",weekdays:[],intervalWeeks:1}};
  board.events=[parent,{...parent,id:id(),name:"Class vacation",parentId:parent.id,target:{scope:"classrooms",ids:[room.id]}}];
  const html=render("Default Holidays");expect(html).toContain('aria-label="Edit holiday Diwali Vacation"');expect(html).toContain('aria-label="Delete holiday Diwali Vacation"');expect(html).toContain("Overrides Diwali Vacation");expect(html).toContain("Add weekly holiday");expect(html).toContain("Add targeted override");expect(html).not.toContain("Weekly non-working days");expect(html).not.toContain("Working-day exception");
 });
 it("makes uncovered classroom inheritance actionable",()=>{
  const {render}=fixture(),html=render("Default Bell Time");expect(html).toContain("4A");expect(html).toContain("No default configured");expect(html).toContain("Add a school default");
 });
 it("displays unified timing rules in Advanced Scheduling",()=>{
  const {board,render}=fixture();board.events=[{id:id(),name:"Friday shorter timing",kind:"working",operation:"timing",configurationPart:"advanced",target:{scope:"school",ids:[]},rule:{type:"weekly",weekdays:[5],intervalWeeks:1},scheduleId:id()}];
  const html=render("Advanced Scheduling");expect(html).toContain('aria-label="Edit rule Friday shorter timing"');expect(html).toContain('aria-label="Delete rule Friday shorter timing"');expect(html).toContain("Friday shorter timing");expect(html).toContain("Different bell timing");expect(html).toContain("Default Holidays take priority");
 });
 it("keeps historical scheduling controls read-only",()=>{
  const {render}=fixture(),html=render("Default Holidays",false);expect(html).toMatch(/disabled=""[^>]*>Add holiday/);expect(html).toMatch(/disabled=""[^>]*>Save &amp; apply/);
 });
 it("does not repeat target and recurrence selection while creating a linked template",()=>{
  const {board}=fixture();const html=renderToStaticMarkup(React.createElement(NavigationProvider,null,React.createElement(ScheduleWizard,{yearId:id(),board,boards:[board],resolverVersion:2,templateMode:true,onSave:()=>{},onCancel:()=>{}})));expect(html).toContain("The advanced rule controls who and when");expect(html).not.toContain("Who does this apply to?");expect(html).not.toContain("Advanced date settings");
 });

});
