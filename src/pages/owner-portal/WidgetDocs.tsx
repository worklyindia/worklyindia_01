import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import CopyPageButton from "@/components/docs/CopyPageButton";
import { goBack } from "@/lib/goBack";

const SNIPPET = `<script src="https://worklyindia.devs.surf/widget/workly-chat.js"
        data-widget-id="YOUR_WIDGET_ID"
        data-position="right" async></script>`;

const Code = ({ children }: { children: string }) => (
  <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs leading-5">{children}</pre>
);

export default function WidgetDocs() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4">
        <Button variant="ghost" size="icon" onClick={() => goBack(navigate, "/developers")} aria-label="Back to Developer Portal"><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-lg font-semibold">Widget Guide</h1>
        <CopyPageButton title="Widget Guide" />
      </header>
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6 text-sm leading-6 text-muted-foreground sm:px-6">
        <div className="flex items-center gap-2 text-foreground"><MessageCircle className="h-6 w-6 text-primary" /><h2 className="text-2xl font-semibold">Workly Chat &amp; Email Widgets</h2></div>
        <section className="border-b border-border py-6">
          <h3 className="text-lg font-semibold text-foreground">Why use a widget?</h3>
          <p className="mt-3">The widgets give you and your trusted team a convenient way to open Workly Chat or Workly Email from your own admin page. Your team can access your connected inboxes without leaving your daily workflow to find the Workly India website. The widget opens Workly India in a separate tab; it is not a public visitor chat or customer-support box.</p>
        </section>
        <section className="border-b border-border py-6">
          <h3 className="text-lg font-semibold text-foreground">Set up on a private admin page</h3>
          <ol className="mt-3 list-decimal space-y-3 pl-5">
            <li>Open Developer menu → Chat Widget.</li>
            <li>Set a 6-digit Widget PIN and share it only with trusted team members who should access your inboxes.</li>
            <li>Choose Left or Right for the widget position.</li>
            <li>Copy the Workly Chat or Workly Email install code and paste it before <code>&lt;/body&gt;</code> on your private, sign-in-protected admin page.</li>
            <li>Open the widget and enter your PIN to access the connected inboxes. Keep your API subscription active.</li>
          </ol>
          <Code>{SNIPPET}</Code>
          <p className="mt-3">Use your own Widget ID from the Chat Widget page. For Workly Email, copy its separate install code, which includes <code>data-app="email"</code>.</p>
        </section>
        <section className="border-b border-border py-6">
          <h3 className="text-lg font-semibold text-foreground">Keep access private</h3>
          <ul className="mt-3 list-disc space-y-3 pl-5">
            <li>Do not install the widget on a public page or share your PIN publicly. It is intended for your admin workspace and trusted team, not website visitors.</li>
            <li>Anyone with the correct PIN may gain access to your account's connected inboxes. Only give it to people you authorize to read and act on those messages.</li>
            <li>Update your PIN regularly, whenever a team member leaves or no longer needs access, and immediately if you suspect it has been shared or misused.</li>
            <li>A PIN change protects future unlocks; it does not necessarily sign out people who already gained access. Review existing access separately if you suspect misuse.</li>
          </ul>
        </section>
        <section className="py-6">
          <h3 className="text-lg font-semibold text-foreground">Your responsibility</h3>
          <p className="mt-3">Workly India provides the widget. You decide where to install it, who can use your admin page, and who receives your PIN. You are responsible for those access decisions and for unauthorized use caused by sharing or exposing your PIN. Keep your admin page protected and your team access up to date.</p>
        </section>
      </main>
    </div>
  );
}
