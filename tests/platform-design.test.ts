import React from "react";
import {renderToStaticMarkup as render} from "react-dom/server";
import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
import {statusTone} from "../apps/web/lib/design-system";
import {Badge,Button,DetailGrid} from "../apps/web/components/ui";
import {WorkspaceTabs} from "../apps/web/components/workspace/tabs";
import {WorkspaceSkeleton,PlatformOperations} from "../apps/web/components/platform-primitives";

describe("Platform UI regression",()=>{
 it("does not mistake negative statuses for successful substrings",()=>{
  for(const value of ["INCOMPLETE","NOT_PAID","NOT_SIGNED","NOT_READY"]) expect(statusTone(value)).toBe("warning");
  expect(statusTone("INACTIVE")).toBe("neutral");
  expect(statusTone("PUBLISHED")).toBe("success");
  expect(render(React.createElement(Badge,{value:"EXPIRED"}))).toContain('data-tone="danger"');
 });
 it("disables a pending action and exposes its loading state",()=>{
  const html=render(React.createElement(Button,{loading:true,loadingLabel:"Saving changes",children:"Save"}));
  expect(html).toContain('aria-busy="true"');expect(html).toContain('disabled=""');expect(html).toContain("Saving changes");
 });
 it("retains accessible active and completed step semantics",()=>{
  const html=render(React.createElement(WorkspaceTabs,{id:"setup",label:"Setup stages",value:"b",numbered:true,onChange:()=>{},tabs:[{value:"a",label:"Identity",complete:true},{value:"b",label:"Schools"}]}));
  expect(html).toContain('data-complete="true"');expect(html).toContain('aria-selected="true"');expect(html).toContain('aria-controls="setup-panel-b"');expect(html).toContain('tabindex="-1"');
 });
 it("keeps readable labels, multi-board data and missing values in record details",()=>{
  const html=render(React.createElement(DetailGrid,{record:{classroomLimit:60,boards:["CBSE","ICSE"]},keys:["classroomLimit","boards","postalCode"]}));
  expect(html).toContain("Classroom allowance");expect(html).toContain("CBSE · ICSE");expect(html).toContain("Not provided");
 });
 it("renders a named loading region without fictitious counts",()=>{
  expect(render(React.createElement(WorkspaceSkeleton,{label:"Loading school"}))).toContain('aria-label="Loading school"');
  const html=render(React.createElement(PlatformOperations,{institutions:[],subscriptions:[],requests:[],onboarding:[],onPage:()=>{},onOnboarding:()=>{}}));
  expect(html).toContain("No unfinished onboarding records");expect(html).not.toContain("UI Preview");
 });
 it("maintains AA normal-text contrast for every semantic foreground on its soft surface",()=>{
  const css=readFileSync("apps/web/app/design-tokens.css","utf8");
  const color=(name:string)=>css.match(new RegExp(`--${name}: (#[a-f0-9]{6})`))![1];
  const luminance=(hex:string)=>{const c=hex.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
  for(const tone of ["brand","teal","success","warning","danger","info","advanced","neutral"]){const a=luminance(color(tone)),b=luminance(color(`${tone}-soft`));expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05),tone).toBeGreaterThanOrEqual(4.5);}
 });
});
