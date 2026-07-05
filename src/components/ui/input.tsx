import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-[10px] border border-input bg-card px-3.5 py-2 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-placeholder focus-visible:border-foreground focus-visible:border-[1.5px] focus-visible:ring-3 focus-visible:ring-secondary disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-secondary/50 disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-[13.5px] dark:bg-input/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
