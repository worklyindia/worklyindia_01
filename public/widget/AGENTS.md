# Website widgets

- Keep the website launcher isolated in Shadow DOM with local semantic CSS tokens; open the real Workly Chat page on the script's own origin in a separate tab so its existing session and authorization protect private social inboxes.
- Retire the AI visitor widget endpoints with HTTP 410; do not embed owner credentials, visitor chat, or privileged API access in the public script.
