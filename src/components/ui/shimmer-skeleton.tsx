import { cn } from "@/lib/utils"

function ShimmerSkeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted relative overflow-hidden",
        "before:absolute before:inset-0",
        "before:-translate-x-full",
        "before:animate-[shimmer_1.5s_infinite]",
        "before:bg-gradient-to-r",
        "before:from-transparent before:via-primary/5 before:to-transparent",
        className
      )}
      {...props}
    />
  )
}

export { ShimmerSkeleton }
