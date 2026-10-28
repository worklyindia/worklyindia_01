import type { ReactNode } from 'react';

interface PublicIntroductionHeroProps {
  image: string;
  imageFallback?: string;
  imageAlt: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  children: ReactNode;
  video?: string;
}

export default function PublicIntroductionHero({ image, imageFallback, imageAlt, eyebrow, title, subtitle, description, children, video }: PublicIntroductionHeroProps) {
  return <section className="public-photo-hero relative isolate overflow-hidden">
    <img src={image} onError={(event) => {
      if (imageFallback && event.currentTarget.getAttribute('src') !== imageFallback) {
        event.currentTarget.src = imageFallback;
      }
    }} alt={imageAlt} width={1536} height={864} fetchPriority="high" className="absolute inset-0 -z-20 h-full w-full object-cover object-right" />
    {video && <video src={video} poster={image} autoPlay muted loop playsInline preload="auto" disablePictureInPicture controls={false} controlsList="nodownload nofullscreen noremoteplayback" onContextMenu={(e) => e.preventDefault()} onPause={(e) => { void e.currentTarget.play().catch(() => {}); }} aria-hidden="true" tabIndex={-1} className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover" />}
    <div className="public-photo-shade absolute inset-0 -z-10" />
    <div className="mx-auto max-w-5xl px-5 py-10 sm:py-16 lg:py-20">
      <p className="text-sm font-semibold">{eyebrow}</p>
      <h1 className="mt-3 max-w-xl text-3xl font-bold leading-tight sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-md text-xl font-semibold leading-relaxed">{subtitle}</p>
      <p className="mt-3 max-w-md text-base leading-7">{description}</p>
      <div className="mt-6 flex flex-nowrap items-center gap-2 sm:gap-3">{children}</div>
    </div>
  </section>;
}