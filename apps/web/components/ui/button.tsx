"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
export const buttonVariants = cva("button", {
  variants: {
    variant: {
      default: "dark",
      outline: "",
      destructive: "danger",
      ghost: "ghost",
    },
    size: { default: "", sm: "small", icon: "icon-only" },
  },
  defaultVariants: { variant: "outline", size: "default" },
});
export const ShadcnButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & { asChild?: boolean }
>(
  (
    { className, variant, size, asChild = false, type = "button", ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={type}
        data-slot="button"
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
ShadcnButton.displayName = "Button";
