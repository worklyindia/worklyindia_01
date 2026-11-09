# Workly India

**Workly India** is an India-focused job and hiring platform that helps job seekers discover opportunities and employers connect with candidates.

- **Website:** https://worklyindia.devs.surf
- **GitHub:** https://github.com/worklyindia/worklyindia_01
- **Lovable workspace:** https://lovable.dev/projects/0ce14714-2158-4b09-9c65-adb5cf975ed8

This repository contains the application source code. Production services such as Supabase, Firebase, Vercel and Cloudflare are configured separately and may require access to their respective dashboards.

## Product overview

Workly India brings job discovery and hiring workflows together, with supporting tools and communication features. Depending on account access and service configuration, the platform includes:

- Job discovery, applications and employer job-posting workflows
- Job seeker and employer account experiences
- Candidate/employer communication and inbox integrations
- Resume and career-support tools
- Email, web-push and mobile-push notification integrations
- Social and messaging integrations through supported Meta APIs
- Trust, safety, help and developer information pages

Feature availability can depend on account permissions, provider approval, environment configuration and deployment status. Code being present does not by itself mean a third-party integration is active.

## Technology

| Area | Technology |
| --- | --- |
| Frontend | React 18, TypeScript |
| Build and development | Vite |
| UI | Tailwind CSS, shadcn/ui, Radix UI |
| Routing and data | React Router, TanStack Query |
| Backend services | Supabase (database, authentication and Edge Functions) |
| Push notifications | Firebase Cloud Messaging / Firebase |
| Hosting and deployment | Vercel |
| DNS, CDN and object storage integrations | Cloudflare |
| Android application | Native Android project (Kotlin) |

Lovable is used as a development workspace connected to this GitHub repository. The application remains a source-controlled project and can be edited through Lovable or a local development environment.

## Getting started

### Requirements

- Node.js (current LTS recommended)
- npm
- Git

### Run locally

~~~bash
git clone https://github.com/worklyindia/worklyindia_01.git
cd worklyindia_01
npm install
npm run dev
~~~

Vite prints the local development URL in the terminal. The development server is configured to use port 8080.

### Production build

~~~bash
npm run build
~~~

The production build runs the repository's domain synchronization, Android release-info generation and dynamic sitemap generation scripts before invoking Vite.

### Other useful commands

~~~bash
npm run lint
npm run preview
npm run build:dev
~~~

- lint runs ESLint.
- preview serves the locally generated production build.
- build:dev creates a development-mode build.

## Working with Lovable

Open the [Workly India Lovable project](https://lovable.dev/projects/0ce14714-2158-4b09-9c65-adb5cf975ed8) to continue editing with prompts.

- Lovable changes are synchronized with the connected GitHub repository.
- Changes pushed to the connected repository can be reflected in Lovable.
- Avoid editing the same files simultaneously in Lovable and another Git branch; sync or pull the latest changes first.
- Review the diff and run the build before merging or deploying substantial changes.

## Backend and integrations

### Supabase

Supabase-backed functionality is configured separately from the frontend source. Edge Functions are stored under:

~~~text
supabase/functions/
~~~

Deploy or manage Edge Functions using the project's authorized Supabase workflow or CLI. Confirm the target project before deploying. Keep service-role keys and other secrets in Supabase secrets or hosting-provider environment settings—never in committed source files.

### Firebase

Firebase supports push-notification functionality. Configure the correct Firebase project, web configuration, Android app registration and messaging credentials in the appropriate environment and platform settings. Device/browser permission and a valid push subscription or FCM token are also required for delivery.

### Android

The native Android project is maintained in:

~~~text
native/android/
~~~

Open the project in Android Studio to build and test the native application. Test notification permissions, deep links and device-specific behavior on a real device as well as an emulator.

### Vercel and Cloudflare

The web application is hosted through the project's deployment configuration. When GitHub is connected to Vercel, pushes to the configured production branch can trigger a deployment. Check Vercel deployment and build logs rather than assuming a GitHub commit is already live.

Cloudflare services (such as DNS, CDN or R2 where configured) are managed in the relevant Cloudflare account. Verify bucket access, token scope, cache rules and domain settings independently.

## Configuration and secrets

Before running or deploying the application, configure the environment variables required by the code and external services.

1. Review environment-variable references in the source and deployment settings.
2. Add local-only values to an ignored environment file, if required.
3. Add production values to the appropriate Supabase, Vercel, Firebase or Cloudflare configuration.
4. Use least-privilege tokens and rotate credentials if they have been exposed.
5. Never commit .env files, private keys, access tokens, service-role keys, signing credentials or personal customer data.

Do not copy production secrets into issues, screenshots, README files or chat messages.

## Deployment checklist

- [ ] Confirm the target Git branch and review code changes.
- [ ] Confirm required environment variables and service credentials are configured.
- [ ] Run npm run lint and npm run build.
- [ ] Check Vercel build and deployment status.
- [ ] Verify the production website and important routes.
- [ ] Check Supabase Edge Function status and logs for backend changes.
- [ ] Test authentication, job workflows and notifications with test accounts.
- [ ] Test the Android build and push-notification flow on a supported device when Android code changes.

A successful frontend deployment does not automatically deploy Supabase Edge Functions or publish a new Android app release. Those are separate release steps.

## Repository structure

Key project directories include:

~~~text
.
├── public/                 # Static assets, manifest and service-worker assets
├── src/                    # React application source
├── native/android/         # Native Android application
├── supabase/functions/     # Supabase Edge Functions
├── scripts/                # Build, sitemap and automation scripts
├── index.html              # HTML entry point and document metadata
├── package.json            # Dependencies and npm scripts
└── vite.config.ts          # Vite configuration
~~~

The repository may contain additional configuration, documentation and service-specific directories.

## Contributing and change safety

- Keep changes focused and explain their purpose in the commit message.
- Preserve authentication, authorization and data-access protections.
- Validate user input and treat external webhook payloads as untrusted.
- Do not log passwords, access tokens, private messages or sensitive personal data.
- Add or update tests when changing critical workflows.
- Do not claim an integration, verification badge or employer/job listing is verified unless the relevant verification process has succeeded.

## Help and links

- **Website:** https://worklyindia.devs.surf
- **Lovable:** https://lovable.dev/projects/0ce14714-2158-4b09-9c65-adb5cf975ed8
- **Repository:** https://github.com/worklyindia/worklyindia_01
- **Lovable docs:** https://docs.lovable.dev/
- **Vite docs:** https://vite.dev/guide/
- **Supabase docs:** https://supabase.com/docs
- **Vercel docs:** https://vercel.com/docs
- **Firebase docs:** https://firebase.google.com/docs

---

© Workly India. All rights reserved.
