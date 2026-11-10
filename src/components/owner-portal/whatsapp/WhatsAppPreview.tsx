import { ArrowUpRight, Copy, FileText, Image, Phone, Play, Reply } from "lucide-react";
import whatsappDoodle from "@/assets/wallpapers/whatsapp-doodle.webp";
import { Button } from '@/components/ui/button';
import { WhatsAppText } from '@/components/whatsapp/WhatsAppText';
import { whatsappWebHref } from '@/lib/whatsappLinks';

interface WhatsAppPreviewProps {
  header?: { type: string; content: string };
  body: string;
  footer?: string;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
}

export function WhatsAppPreview({ header, body, footer, buttons = [] }: WhatsAppPreviewProps) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/30 p-3 sm:p-4">
      <div className="mb-3 text-center text-xs text-muted-foreground">WhatsApp Preview</div>
      <div className="mx-auto max-w-[340px] overflow-hidden rounded-lg border border-wa-preview-border bg-wa-preview-screen">
        <div className="flex items-center gap-2 bg-wa-preview-chrome px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wa-preview-media text-wa-preview-action"><Phone className="h-4 w-4" /></div>
          <div className="min-w-0 text-sm font-medium text-wa-preview-text">Workly India</div>
        </div>
        <div className="relative min-h-[320px] bg-wa-preview-screen p-3">
          <img src={whatsappDoodle} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 invert" />
          <div className="relative overflow-hidden rounded-lg rounded-tl-sm bg-wa-preview-bubble text-wa-preview-text shadow-sm">
            {header?.type && header.type !== "none" && header.type !== "TEXT" && (
              <div className="p-1.5">
                {header.type === "IMAGE" && (header.content ? <img loading="lazy" decoding="async" src={header.content} alt="Message header" className="block h-auto w-full rounded" /> : <div className="flex aspect-[2/1] items-center justify-center rounded bg-wa-preview-media"><Image className="h-8 w-8 text-wa-preview-muted" /></div>)}
                {header.type === "VIDEO" && <div className="flex aspect-[2/1] items-center justify-center rounded bg-wa-preview-media"><Play className="h-8 w-8" /></div>}
                {header.type === "DOCUMENT" && <div className="flex items-center gap-2 rounded bg-wa-preview-media p-4"><FileText className="h-6 w-6" /> Document</div>}
              </div>
            )}
            {header?.type === "TEXT" && header.content && <div className="break-words px-3 pt-2.5 text-sm font-bold">{header.content}</div>}
            <div className="px-3 pb-1 pt-2">
              {body ? <div className="whitespace-pre-wrap break-words text-[13px] leading-[1.5] [&_a]:text-wa-preview-action"><WhatsAppText text={body} /></div> : <div className="text-sm italic text-wa-preview-muted">Type your message...</div>}
            </div>
            <div className="flex items-end justify-between gap-2 px-3 pb-2 pt-1 text-[11px] text-wa-preview-muted">
              <span className="min-w-0 break-words [&_a]:text-wa-preview-action"><WhatsAppText text={footer} /></span>
              <time className="shrink-0">{new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}</time>
            </div>
            {buttons.length > 0 && <div className="border-t border-wa-preview-border">
              {buttons.map((button, index) => {
                const href = button.type === 'URL' ? whatsappWebHref(button.url) : button.type === 'PHONE_NUMBER' && /^\+?\d[\d\s-]+$/.test(button.phone_number || '') ? `tel:${button.phone_number}` : undefined;
                const children = <>
                {button.type === "URL" ? <ArrowUpRight className="h-4 w-4 shrink-0" /> : button.type === "PHONE_NUMBER" ? <Phone className="h-4 w-4 shrink-0" /> : button.type === "OTP" ? <Copy className="h-4 w-4 shrink-0" /> : <Reply className="h-4 w-4 shrink-0" />}
                <span className="break-words">{button.text || `Button ${index + 1}`}</span>
                </>;
                return <Button key={index} variant="ghost" asChild={!!href} disabled={!href} className="flex h-auto min-h-10 w-full items-center justify-center gap-2 whitespace-normal rounded-none border-b border-wa-preview-border px-2 py-2 text-center text-sm font-medium text-wa-preview-action last:border-b-0 disabled:opacity-100">
                  {href ? <a href={href} target={button.type === 'URL' ? '_blank' : undefined} rel="noopener noreferrer">{children}</a> : children}
                </Button>;
              })}
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}
