import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium", {
  variants: {
    variant: {
      default: "bg-muted text-muted-foreground",
      primary: "bg-accent text-accent-foreground",
      positive: "bg-positive-muted text-positive",
      negative: "bg-negative-muted text-negative",
      warning: "bg-warning/15 text-warning",
      outline: "border text-muted-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
