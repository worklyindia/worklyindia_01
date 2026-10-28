import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const YouTubeLogo: React.FC<LogoProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect width="24" height="24" rx="6" fill="#FF0000" />
    <path d="M9.5 15.5V8.5L15.5 12L9.5 15.5Z" fill="white" />
  </svg>
);

export const XLogo: React.FC<LogoProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M17.6871 3H20.5126L14.4756 9.976L21.6667 20.2H15.7237L11.302 14.2239L6.386 20.2H3.56L9.996 12.792L3 3H9.08867L13.1167 8.51733L17.6871 3ZM16.6427 18.5333H18.2827L8.08 4.56H6.324L16.6427 18.5333Z"
      fill="currentColor"
    />
  </svg>
);

export const LinkedInLogo: React.FC<LogoProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect width="24" height="24" rx="4" fill="#0A66C2" />
    <path
      d="M5.372 8.5H8.168V18.5H5.372V8.5ZM6.77 4.5C7.73 4.5 8.508 5.278 8.508 6.238C8.508 7.198 7.73 7.976 6.77 7.976C5.81 7.976 5.032 7.198 5.032 6.238C5.032 5.278 5.81 4.5 6.77 4.5Z"
      fill="white"
    />
    <path
      d="M9.968 8.5H12.68V9.914H12.722C13.13 9.158 14.084 8.356 15.506 8.356C17.462 8.356 18.932 9.782 18.932 12.662V18.5H16.136V13.142C16.136 11.93 15.752 11.12 14.72 11.12C13.952 11.12 13.484 11.66 13.268 12.188C13.196 12.368 13.172 12.614 13.172 12.86V18.5H10.376L10.376 8.5H9.968Z"
      fill="white"
    />
  </svg>
);

export const TelegramLogo: React.FC<LogoProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="12" fill="#24A1DE" />
    <path
      d="M5.491 11.8067L16.9471 7.19533C17.4871 6.98133 17.9711 7.30067 17.7831 8.18867L15.7831 17.4887C15.6271 18.1687 15.2271 18.34 14.6671 18.0147L11.6271 15.7947L10.2271 17.1487C10.0671 17.3027 9.93307 17.4367 9.65307 17.4367L9.85307 14.3907L15.3871 9.45867C15.6071 9.25867 15.3411 9.14667 15.0411 9.34467L8.38707 13.5107L5.37307 12.6487C4.70707 12.4427 4.69307 11.9987 5.491 11.8067Z"
      fill="white"
    />
  </svg>
);

export const BitbucketLogo: React.FC<LogoProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <path d="M2.5 4.5C2.5 3.67 3.17 3 4 3h16c.83 0 1.5.67 1.5 1.5l-2 14.5c0 .83-.67 1.5-1.5 1.5H6c-.83 0-1.5-.67-1.5-1.5L2.5 4.5z" fill="#2684FF" />
    <path d="M15.5 15.5h-7L8 7h8l-.5 8.5z" fill="#fff" />
    <path d="M15.5 15.5l1.5-8.5H19l-1.5 8.5h-2z" fill="#B3D4FF" />
  </svg>
);

export const DiscordLogo: React.FC<LogoProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="#5865F2" />
    <path d="M17.3 8.1c-.4-.3-1.5-.7-2.8-.8-.1.2-.3.6-.4.9 1.1-.1 1.8-.3 2.3-.6-.1.1-.3.3-.5.4-.1 0-.1 0-.1.1-.1 0-.1.1-.2.1-.1.1-.2.1-.3.2-.2.1-.4.3-.6.4-.6.4-1.3 1-1.7 1.8-.4.8-.6 1.7-.6 2.6 0 .2 0 .3.1.5.2.3.6.6 1 .7.4.2.9.3 1.4.3.5 0 1-.1 1.4-.3.4-.2.8-.4 1-.7.1-.2.1-.3.1-.5 0-.9-.2-1.8-.6-2.6-.4-.8-1.1-1.4-1.7-1.8zM11.2 12c-.4 0-.7-.3-.7-.7 0-.4.3-.7.7-.7.4 0 .7.3.7.7 0 .4-.3.7-.7.7zm3.6 0c-.4 0-.7-.3-.7-.7 0-.4.3-.7.7-.7.4 0 .7.3.7.7 0 .4-.3.7-.7.7zM9.2 7.3C7.9 7.4 6.8 7.8 6.4 8.1c-.4.8-.6 1.7-.6 2.6 0 .2 0 .3.1.5.2.3.6.6 1 .7.4.2.9.3 1.4.3.5 0 1-.1 1.4-.3.4-.2.8-.4 1-.7.1-.2.1-.3.1-.5 0-.9-.2-1.8-.6-2.6-.4-.4-1-.6-2-.8zm-1.4 3.7c-.4 0-.7-.3-.7-.7 0-.4.3-.7.7-.7.4 0 .7.3.7.7 0 .4-.3.7-.7.7z" fill="#fff" />
  </svg>
);

export const FigmaLogo: React.FC<LogoProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <path d="M8 24c2.2 0 4-1.8 4-4v-4H8c-2.2 0-4 1.8-4 4s1.8 4 4 4z" fill="#0ACF83" />
    <path d="M4 12c0-2.2 1.8-4 4-4h4v8H8c-2.2 0-4-1.8-4-4z" fill="#A259FF" />
    <path d="M4 4c0-2.2 1.8-4 4-4h4v8H8C5.8 8 4 6.2 4 4z" fill="#F24E1E" />
    <path d="M12 0h4c2.2 0 4 1.8 4 4s-1.8 4-4 4h-4V0z" fill="#FF7262" />
    <path d="M20 12c0 2.2-1.8 4-4 4s-4-1.8-4-4 1.8-4 4-4 4 1.8 4 4z" fill="#1ABCFE" />
  </svg>
);

export const NotionLogo: React.FC<LogoProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <rect width="24" height="24" rx="6" fill="#000" />
    <path d="M5.5 5.5h10.5l2.5 2.5v10.5H8l-2.5-2.5V5.5z" fill="#fff" />
    <path d="M8 8h8v2H8V8zm0 4h8v2H8v-2zm0 4h5v2H8v-2z" fill="#000" />
  </svg>
);

export const TwitchLogo: React.FC<LogoProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <rect width="24" height="24" rx="4" fill="#9146FF" />
    <path d="M6.5 4L4 6.5v11h4V20l2.5-2.5h2L18 12.5V4H6.5zm9.5 7.5l-2.5 2.5h-2L9 16V6h7v5.5z" fill="#fff" />
    <path d="M13 8h1.5v3H13V8zm-3 0h1.5v3H10V8z" fill="#fff" />
  </svg>
);

export const SlackLogo: React.FC<LogoProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <path d="M5.5 14.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5zm0 0v4c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5v-4H5.5z" fill="#E01E5A" />
    <path d="M9.5 5.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5zm0 0h4c1.4 0 2.5-1.1 2.5-2.5S14.9.5 13.5.5h-4v5z" fill="#36C5F0" />
    <path d="M18.5 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5zm0 0v-4c0-1.4-1.1-2.5-2.5-2.5S13.5 4.1 13.5 5.5v4h5z" fill="#2EB67D" />
    <path d="M14.5 18.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5zm0 0h-4c-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5h4v-5z" fill="#ECB22E" />
  </svg>
);

export const SpotifyLogo: React.FC<LogoProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="#1DB954" />
    <path d="M17.5 10.5c-2.5-1.5-6.5-1.6-8.8-.9-.4.1-.8-.1-.9-.5-.1-.4.1-.8.5-.9 2.6-.8 6.9-.7 9.7.9.4.2.5.7.3 1-.2.3-.6.5-1 .4-.6-.3-1.2-.6-1.8-1zm-.2 2.4c-2.1-1.3-5.3-1.6-7.8-.9-.3.1-.7-.1-.8-.4-.1-.3.1-.7.4-.8 2.8-.8 6.3-.5 8.7.9.3.2.4.6.2.9-.2.3-.6.4-.9.2-.6-.3-1.2-.6-1.8-1zm-.3 2.5c-1.8-1.1-4.5-1.4-6.6-.8-.3.1-.5-.1-.6-.3-.1-.3.1-.5.3-.6 2.3-.7 5.3-.4 7.4.8.2.1.3.4.2.7-.1.2-.4.3-.7.2z" fill="#fff" />
  </svg>
);

export const WorkOSLogo: React.FC<LogoProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <rect width="24" height="24" rx="6" fill="#6366F1" />
    <path d="M6 8h2.5l2 6.5L12.5 8H15l2 6.5L19 8h2l-3.2 9h-2.3l-2-6.3-2 6.3H9L6 8z" fill="#fff" />
  </svg>
);

export const AzureLogo: React.FC<LogoProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <rect width="24" height="24" rx="4" fill="#0078D4" />
    <path d="M6 17.5l6-10.5 6 3.5-6 10.5-6-3.5z" fill="#fff" />
    <path d="M12 7L6 17.5h12L12 7z" fill="#50E6FF" />
  </svg>
);

export const SupabaseLogo: React.FC<LogoProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <path d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12z" fill="#3ECF8E" />
    <path d="M16.5 16.5H9.3c-.5 0-.9-.4-.9-.9V7.2c0-.5.4-.9.9-.9h7.2c.5 0 .9.4.9.9v8.4c0 .5-.4.9-.9.9z" fill="#fff" />
    <path d="M7.5 16.5V9.3c0-.5-.4-.9-.9-.9H4.8c-.5 0-.9.4-.9.9v7.2c0 .5.4.9.9.9h1.8c.5 0 .9-.4.9-.9z" fill="#fff" />
  </svg>
);

export const VercelLogo: React.FC<LogoProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <path d="M12 2L22 20H2L12 2z" fill="currentColor" />
  </svg>
);

