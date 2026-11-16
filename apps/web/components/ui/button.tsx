"use client";
import * as React from "react";
import {Slot} from "@radix-ui/react-slot";
import {Loader2} from "lucide-react";
import {cva,type VariantProps} from "class-variance-authority";
import {cn} from "../../lib/utils";
/** Project-owned adaptation of the accessible Radix/CVA button patterns reviewed
 * in 21st.dev's Origin UI collection. No authenticated registry source is copied. */
export const buttonVariants=cva("button",{
  variants:{variant:{default:"dark",secondary:"secondary",outline:"",destructive:"danger",ghost:"ghost"},size:{default:"",sm:"small",icon:"icon-only"}},
  defaultVariants:{variant:"outline",size:"default"},
});
export const ShadcnButton=React.forwardRef<HTMLButtonElement,React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & {asChild?:boolean;loading?:boolean;loadingLabel?:string}>(
  ({className,variant,size,asChild=false,type="button",loading=false,loadingLabel,disabled,children,...props},ref)=>{
    const Comp=asChild?Slot:"button";
    return <Comp ref={ref} type={type} data-slot="button" className={cn(buttonVariants({variant,size}),className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {asChild?children:<>{loading&&<Loader2 size={15} className="spin" aria-hidden="true"/>}{loading&&loadingLabel?loadingLabel:children}</>}
    </Comp>;
  },
);
ShadcnButton.displayName="Button";
