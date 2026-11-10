import * as React from "react";
import { Toaster as Sonner, toast } from "sonner";
import { useTheme } from "@/hooks/useTheme";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme}
      className="toaster group workly-app-toaster"
      position="top-center"
      offset="max(14px, env(safe-area-inset-top))"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#263F55] group-[.toaster]:text-white group-[.toaster]:border-white/15 group-[.toaster]:shadow-xl group-[.toaster]:py-3 group-[.toaster]:px-4 group-[.toaster]:text-sm group-[.toaster]:rounded-2xl group-[.toaster]:w-[calc(100vw-28px)] group-[.toaster]:max-w-[440px]",
          title: "group-[.toast]:text-sm group-[.toast]:font-semibold group-[.toast]:text-white",
          description: "group-[.toast]:text-xs group-[.toast]:text-white/85",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:text-xs group-[.toast]:py-1 group-[.toast]:px-2",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
