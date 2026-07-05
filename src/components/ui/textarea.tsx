import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-[52px] w-full rounded-[10px] border border-input bg-card px-3.5 py-2.5 text-base transition-colors outline-none placeholder:text-placeholder focus-visible:border-foreground focus-visible:border-[1.5px] focus-visible:ring-3 focus-visible:ring-secondary disabled:cursor-not-allowed disabled:bg-secondary/50 disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-[13.5px] dark:bg-input/20",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
