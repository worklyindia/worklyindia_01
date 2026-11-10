import * as React from "react"

import { cn } from "@/lib/utils"

type AvatarLoadingStatus = "idle" | "loading" | "loaded" | "error"

const AvatarContext = React.createContext<{
  imageLoadingStatus: AvatarLoadingStatus
  setImageLoadingStatus: (status: AvatarLoadingStatus) => void
} | null>(null)

const Avatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const [imageLoadingStatus, setImageLoadingStatus] =
    React.useState<AvatarLoadingStatus>("idle")

  return (
    <AvatarContext.Provider value={{ imageLoadingStatus, setImageLoadingStatus }}>
      <div
        ref={ref}
        className={cn(
          "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
          className
        )}
        {...props}
      />
    </AvatarContext.Provider>
  )
})
Avatar.displayName = "Avatar"

type AvatarImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  onLoadingStatusChange?: (status: AvatarLoadingStatus) => void
}

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  AvatarImageProps
>(({ className, decoding, referrerPolicy, src, onLoad, onError, onLoadingStatusChange, ...props }, ref) => {
  const context = React.useContext(AvatarContext)
  const [status, setStatus] = React.useState<AvatarLoadingStatus>(src ? "loading" : "idle")

  const updateStatus = React.useCallback((nextStatus: AvatarLoadingStatus) => {
    setStatus(nextStatus)
    context?.setImageLoadingStatus(nextStatus)
    onLoadingStatusChange?.(nextStatus)
  }, [context, onLoadingStatusChange])

  React.useEffect(() => {
    const nextStatus = src ? "loading" : "idle"
    setStatus(nextStatus)
    context?.setImageLoadingStatus(nextStatus)
    onLoadingStatusChange?.(nextStatus)
    // Only reset loading when the actual source changes. Depending on the
    // context/update callback here would flip a successfully loaded image back
    // to loading after the parent Avatar stores the loaded state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  if (!src || status === "error") return null

  return (
    <img
      ref={ref}
      src={src}
      // Use the real rendered <img> for loading instead of Radix's hidden
      // preloader; this keeps no-referrer intact on Vercel for Google/LinkedIn DP.
      referrerPolicy={referrerPolicy ?? "no-referrer"}
      decoding={decoding ?? "async"}
      className={cn("aspect-square h-full w-full object-cover", className)}
      onLoad={(event) => {
        updateStatus("loaded")
        onLoad?.(event)
      }}
      onError={(event) => {
        updateStatus("error")
        onError?.(event)
      }}
      {...props}
    />
  )
})
AvatarImage.displayName = "AvatarImage"

type AvatarFallbackProps = React.HTMLAttributes<HTMLSpanElement> & {
  delayMs?: number
}

const AvatarFallback = React.forwardRef<
  HTMLSpanElement,
  AvatarFallbackProps
>(({ className, delayMs, ...props }, ref) => {
  const context = React.useContext(AvatarContext)
  const [canRender, setCanRender] = React.useState(delayMs === undefined)

  React.useEffect(() => {
    if (delayMs === undefined) {
      setCanRender(true)
      return
    }

    setCanRender(false)
    const timer = window.setTimeout(() => setCanRender(true), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs])

  if (!canRender || context?.imageLoadingStatus === "loaded") return null

  return (
    <span
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted",
        className
      )}
      {...props}
    />
  )
})
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
