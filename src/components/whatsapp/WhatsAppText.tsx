import { Fragment, type ReactNode } from 'react';
import { whatsappWebHref } from '@/lib/whatsappLinks';

const LINK = /((?:https?:\/\/|www\.)[^\s<>]+|(?:[a-z\d-]+\.)+(?:com|in|net|org|io|co|app|dev|me|online|site|store)(?:\/[^\s<>]*)?)/gi;
const STYLE = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|```[^`]+```)/g;

function styled(text: string): ReactNode {
  return text.split(STYLE).map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) return <code key={i} className="font-mono">{part.slice(3, -3)}</code>;
    if (part.startsWith('*') && part.endsWith('*')) return <strong key={i}>{part.slice(1, -1)}</strong>;
    if (part.startsWith('_') && part.endsWith('_')) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('~') && part.endsWith('~')) return <del key={i}>{part.slice(1, -1)}</del>;
    return part;
  });
}

/** Keep the actual URL visible, including links in template footers. */
export function WhatsAppText({ text }: { text?: string | null }) {
  return <>{(text || '').split(LINK).map((part, i) => {
    const url = part.replace(/[.,!?;:)]+$/, '');
    const href = i % 2 === 1 ? whatsappWebHref(url) : undefined;
    return <Fragment key={i}>{href ? <><a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-whatsapp-green underline underline-offset-2 break-words">{url}</a>{part.slice(url.length)}</> : styled(part)}</Fragment>;
  })}</>;
}