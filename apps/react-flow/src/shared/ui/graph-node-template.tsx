import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/shared/lib/cn";

export function GraphNodeTemplate({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("h-full w-full rounded-lg border border-border/80 bg-card/90 text-card-foreground", className)} {...props} />;
}

export function GraphNodeAccent({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return <span className={cn("h-9 w-0.5 rounded bg-primary/90", className)} aria-hidden {...props} />;
}
