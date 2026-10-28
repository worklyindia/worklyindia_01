import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LoginRequiredSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "send messages" */
  feature?: string;
}

export const LoginRequiredSheet = ({ open, onOpenChange, feature }: LoginRequiredSheetProps) => {
  const navigate = useNavigate();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-6 pb-8 pt-3">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />

        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Sign in to continue</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {feature
              ? `You need an account to ${feature}.`
              : "You need an account to use this feature."}{" "}
            Log in or create a free account to chat with the AI assistant, use voice input, translate
            messages and keep your chat history saved.
          </p>

          <div className="mt-6 flex w-full flex-col gap-3">
            <Button
              className="h-12 w-full rounded-xl text-base"
              onClick={() => {
                onOpenChange(false);
                navigate("/auth?redirect=/ai-assistant");
              }}
            >
              <LogIn className="mr-2 h-5 w-5" />
              Log in
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full rounded-xl text-base"
              onClick={() => {
                onOpenChange(false);
                navigate("/auth?redirect=/ai-assistant&mode=signup");
              }}
            >
              <UserPlus className="mr-2 h-5 w-5" />
              Create free account
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default LoginRequiredSheet;
