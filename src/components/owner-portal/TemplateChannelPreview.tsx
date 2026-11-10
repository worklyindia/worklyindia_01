import { BatteryMedium, Bell, CheckCheck, ChevronLeft, ChevronUp, Copy, ExternalLink, MoreVertical, Search, Signal, Star, Wifi } from 'lucide-react';
import { renderEmailPreviewHtml, renderTelegramPreviewHtml, templateParagraphs } from '@/lib/templateFormatting';
import { cn } from '@/lib/utils';

interface TemplateChannelPreviewProps {
  channel: 'email' | 'push' | 'telegram';
  title: string;
  body: string;
  buttonText?: string;
  imageUrl?: string | null;
  isOtp?: boolean;
  telegramButtons?: TelegramTemplateButton[];
  headerLogoUrl?: string | null;
  socialIcons?: { label: string; imageUrl: string; href?: string }[];
}

export interface TelegramTemplateButton {
  id: string;
  text: string;
  type: 'url' | 'copy_text' | 'web_app';
  value: string;
  row: number;
}

const MessageText = ({ body, className }: { body: string; className?: string }) => (
  <div className={cn('space-y-3 break-words', className)}>
    {templateParagraphs(body).map((lines, paragraphIndex) => (
      <p key={`preview-paragraph-${paragraphIndex}`}>
        {lines.map((line, lineIndex) => (
          <span key={`preview-line-${paragraphIndex}-${lineIndex}`}>
            {line}
            {lineIndex < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    ))}
  </div>
);

const HtmlMessageText = ({ html, className }: { html: string; className?: string }) => (
  <div
    className={cn(
      'space-y-3 break-words [&_a]:font-semibold [&_a]:text-primary [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_ul]:list-disc [&_ul]:pl-5',
      className,
    )}
    dangerouslySetInnerHTML={{ __html: html }}
  />
);

/*
 * Every color below is a `--preview-*` token. Light and dark values are defined
 * in index.css, so the previews follow the device theme together with the rest
 * of the site while staying fully readable in both modes.
 */

/*
 * The mail apps render our email with their own system font stack and the
 * shell's own padding (see supabase/functions/_shared/engagementEmailTemplates
 * `buildBrandedEmail`: padding 30px 12px 26px, 15px / 1.7 text). The preview
 * copies those exact values so a heading that wraps onto two lines in Gmail
 * also wraps here, and the owner sees a true match.
 */
const EMAIL_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

const EmailPreview = ({ title, body, buttonText, imageUrl, headerLogoUrl, socialIcons }: Omit<TemplateChannelPreviewProps, 'channel'>) => {
  return (
  <div
    className="overflow-hidden rounded-lg border border-preview-border bg-preview-email-chrome shadow-medium"
    style={{ fontFamily: EMAIL_FONT_STACK }}
  >
    <div className="flex h-11 items-center gap-3 border-b border-preview-email-border bg-preview-email-chrome px-3">
      <ChevronLeft className="h-5 w-5 text-preview-email-muted" />
      <div className="flex-1 text-center text-sm font-semibold text-preview-email-fg">Inbox</div>
      <Search className="h-5 w-5 text-preview-email-muted" />
      <MoreVertical className="h-5 w-5 text-preview-email-muted" />
    </div>
    <div className="border-b border-preview-email-border bg-preview-email-chrome p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-preview-brand text-sm font-bold text-preview-email-button-fg">WI</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-preview-email-fg">Workly India</p>
          <p className="truncate text-xs text-preview-email-muted">notifications@worklyindia.com</p>
        </div>
        <span className="text-xs text-preview-email-muted">Now</span>
        <Star className="h-4 w-4 text-preview-email-muted" />
      </div>
      <h3 className="mt-4 break-words text-lg font-semibold leading-6 text-preview-email-fg">{title}</h3>
    </div>
    <div className="bg-preview-email-paper">
      <div className="email-theme-content isolate overflow-hidden bg-preview-email-paper text-preview-email-paper-fg [color-scheme:light] dark:[color-scheme:dark]">
        {headerLogoUrl && (
          <div className="flex items-center justify-center border-b border-preview-email-paper-border p-3">
            <img src={headerLogoUrl} alt="Email header logo" className="max-h-20 max-w-full object-contain" />
          </div>
        )}
        {imageUrl && (
          <div className="flex min-h-28 items-center justify-center border-b border-preview-email-paper-border p-3">
            <img src={imageUrl} alt="Email content" className="max-h-56 w-full object-contain" />
          </div>
        )}
        <div style={{ padding: '30px 12px 26px', fontSize: '15px', lineHeight: 1.7 }}>
          <HtmlMessageText
            html={renderEmailPreviewHtml(body)}
            className="text-preview-email-paper-fg [&>*+*]:mt-0 [&_a]:text-preview-email-paper-link [&_blockquote]:border-preview-email-paper-border [&_blockquote]:text-preview-email-paper-muted [&_code]:bg-preview-email-paper-soft [&_h1]:text-preview-email-paper-heading [&_h2]:text-preview-email-paper-heading [&_h3]:text-preview-email-paper-heading [&_pre]:bg-preview-email-paper-soft [&_strong]:text-preview-email-paper-heading"
          />
          {buttonText?.trim() && (
            <div className="mt-5 flex justify-center">
              <span
                className="inline-block max-w-full rounded-[10px] bg-preview-email-button font-bold text-preview-email-button-fg"
                style={{ padding: '14px 30px', fontSize: '16px', lineHeight: 1.2 }}
              >
                {buttonText}
              </span>
            </div>
          )}
        </div>
        {socialIcons && (
          <div className="border-t border-preview-email-paper-border px-2 py-6 text-center">
            <p className="mb-4 text-sm font-bold text-preview-email-paper-heading">Connect with us</p>
            <div className="flex items-center justify-center gap-1">
              {socialIcons.map((icon) => icon.href ? (
                <a key={icon.label} href={icon.href} target="_blank" rel="noopener noreferrer" aria-label={icon.label} className="flex h-10 w-10 shrink-0 items-center justify-center">
                  <img src={icon.imageUrl} alt={icon.label} className="h-9 w-9 object-contain" />
                </a>
              ) : (
                <span key={icon.label} className="flex h-10 w-10 shrink-0 items-center justify-center opacity-40">
                  <img src={icon.imageUrl} alt={icon.label} className="h-9 w-9 object-contain" />
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
  );
};

const PushPreview = ({ title, body, buttonText, imageUrl }: Omit<TemplateChannelPreviewProps, 'channel'>) => (
  <div className="overflow-hidden rounded-lg border border-preview-border bg-preview-push-screen px-3 pb-7 pt-4 shadow-medium">
    <div className="mb-5 flex items-start justify-between text-preview-push-fg">
      <div>
        <p className="text-4xl font-light leading-none">1:09</p>
        <p className="mt-1 text-sm font-medium">Fri, 18 Sept</p>
      </div>
      <div className="flex items-center gap-1 pt-1">
        <Wifi className="h-3.5 w-3.5" />
        <Signal className="h-3.5 w-3.5" />
        <span className="text-[10px] font-semibold">5G</span>
        <BatteryMedium className="h-4 w-4" />
      </div>
    </div>

    <div className="overflow-hidden rounded-[1.65rem] bg-preview-push-card px-4 py-4 text-preview-push-fg shadow-large">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-preview-push-fg/70">
          <Bell className="h-4 w-4" />
        </div>
        <p className="min-w-0 flex-1 truncate text-xs text-preview-push-muted">Workly India</p>
        <span className="shrink-0 text-xs text-preview-push-muted">Just now</span>
        <ChevronUp className="h-4 w-4 shrink-0 text-preview-push-muted" />
      </div>

      <div className="mt-2 pl-10">
        <h3 className="break-words text-base font-semibold leading-5">{title}</h3>
        <MessageText body={body} className="mt-1 text-sm leading-5 text-preview-push-muted" />
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Notification"
            className="mt-3 aspect-[2/1] w-full rounded-lg object-cover"
          />
        )}
        <div className="mt-4 flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5">
          {buttonText?.trim() && (
            <div className="shrink-0 whitespace-nowrap rounded-full bg-preview-push-fg/10 px-4 py-2 text-center text-sm font-medium text-preview-push-fg">
              {buttonText}
            </div>
          )}
          <div className="shrink-0 whitespace-nowrap rounded-full bg-preview-push-fg/10 px-4 py-2 text-center text-sm font-medium text-preview-push-fg">
            Unsubscribe
          </div>
        </div>
      </div>
    </div>
  </div>
);

const TelegramPreview = ({ title, body, buttonText, imageUrl, isOtp, telegramButtons = [] }: Omit<TemplateChannelPreviewProps, 'channel'>) => {
  const legacyButtons: TelegramTemplateButton[] = buttonText?.trim()
    ? [{ id: 'legacy', text: buttonText, type: isOtp ? 'copy_text' : 'url', value: '', row: 0 }]
    : isOtp
      ? [{ id: 'otp-copy', text: 'Copy code', type: 'copy_text', value: '', row: 0 }]
      : [];
  const buttons = telegramButtons.length > 0 ? telegramButtons : legacyButtons;
  const rows = [...new Set(buttons.map((button) => button.row))].sort((a, b) => a - b);

  return (
  <div className="overflow-hidden rounded-lg border border-preview-border bg-preview-telegram-screen shadow-medium">
    <div className="flex h-14 items-center gap-3 bg-preview-telegram-bubble px-3 text-preview-telegram-text">
      <ChevronLeft className="h-5 w-5" />
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-telegram-icon text-sm font-semibold text-preview-telegram-icon-fg">WI</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">Workly India Bot</p>
        <p className="text-xs text-preview-telegram-muted">bot</p>
      </div>
      <MoreVertical className="h-5 w-5" />
    </div>
    <div className="min-h-72 p-2.5">
      <div className="max-w-[94%] overflow-hidden rounded-lg rounded-bl-sm bg-preview-telegram-bubble text-preview-telegram-text shadow-soft">
        {imageUrl && (
          <div className="flex min-h-28 items-center justify-center p-1.5 pb-0">
            <img src={imageUrl} alt="Telegram message" className="max-h-64 w-full rounded-md object-cover" />
          </div>
        )}
        <div className="p-3">
          <h3 className="break-words text-base font-bold leading-5">{title}</h3>
          <HtmlMessageText html={renderTelegramPreviewHtml(body)} className="mt-3 text-sm leading-5 text-preview-telegram-text [&_[data-telegram-entity]]:font-medium [&_[data-telegram-entity]]:text-telegram-tick [&_a]:cursor-pointer [&_a]:text-telegram-tick [&_a]:underline-offset-2 hover:[&_a]:underline [&_code]:rounded [&_code]:bg-preview-telegram-screen/35 [&_code]:px-1 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:rounded [&_pre]:bg-preview-telegram-screen/35 [&_pre]:p-2 [&_blockquote]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-telegram-tick [&_blockquote]:pl-2 [&_tg-spoiler]:rounded [&_tg-spoiler]:bg-preview-telegram-muted [&_tg-spoiler]:text-transparent hover:[&_tg-spoiler]:bg-transparent hover:[&_tg-spoiler]:text-preview-telegram-text" />
          <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-preview-telegram-muted">
            <span>12:47 PM</span><CheckCheck className="h-3.5 w-3.5 text-telegram-tick" />
          </div>
        </div>
      </div>
      {rows.map((row) => (
        <div key={row} className="mt-1 grid max-w-[94%] gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(2, buttons.filter((button) => button.row === row).length)}, minmax(0, 1fr))` }}>
          {buttons.filter((button) => button.row === row).map((button) => (
            <div key={button.id} className="flex min-w-0 items-center justify-center gap-2 rounded-lg bg-preview-telegram-action px-2 py-3 text-center text-sm font-semibold text-preview-telegram-text shadow-soft">
              <span className="truncate">{button.text}</span>
              {button.type === 'copy_text' ? <Copy className="h-4 w-4 shrink-0" /> : <ExternalLink className="h-4 w-4 shrink-0" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
  );
};

export function TemplateChannelPreview(props: TemplateChannelPreviewProps) {
  if (props.channel === 'email') return <EmailPreview {...props} />;
  if (props.channel === 'push') return <PushPreview {...props} />;
  return <TelegramPreview {...props} />;
}
