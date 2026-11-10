/** Shared WhatsApp brand mark for number selection and connection controls. */
export default function WhatsAppLogo({ size = 24 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="WhatsApp" className="shrink-0 text-whatsapp-green">
    <path fill="currentColor" d="M12 .5A11.5 11.5 0 0 0 2.1 17.8L.5 23.5l5.9-1.6A11.5 11.5 0 1 0 12 .5Z" />
    <path className="fill-primary-foreground" d="M17.3 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1l-.9 1.1c-.2.2-.3.2-.6.1a7.8 7.8 0 0 1-3.9-3.4c-.3-.5.3-.5.8-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.4 13.4 0 0 0 5.2 4.6c1.9.8 2.7.9 3.6.7a3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3Z" />
  </svg>;
}
