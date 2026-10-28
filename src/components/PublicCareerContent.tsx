import { Link } from 'react-router-dom';
import { PUBLIC_CAREER_CONTENT } from '@/lib/publicCareerContent.mjs';

export default function PublicCareerContent({ page }: { page: '/jobs' | '/resume-builder' }) {
  const content = PUBLIC_CAREER_CONTENT[page];
  return (
    <section className="border-t border-border py-8">
      <h2 className="text-xl font-semibold text-foreground">{content.heading}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{content.description}</p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {content.sections.map(section => (
          <div key={section.heading}>
            <h3 className="font-semibold text-foreground">{section.heading}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.text}</p>
          </div>
        ))}
      </div>
      <nav aria-label="Career resources" className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        {content.links.map(link => <Link key={link.href} to={link.href} className="text-primary underline underline-offset-4">{link.label}</Link>)}
      </nav>
    </section>
  );
}