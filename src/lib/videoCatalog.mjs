// Shared by React watch pages and the crawler HTML generator so Google sees the same VideoObject facts.
const R2 = 'https://pub-58e90721f9fe42b38ecde13543c608fc.r2.dev';

export const VIDEOS = [
  {
    slug: 'workly-india-promo',
    title: 'Workly India Platform Overview',
    description: 'A 30-second look at how Workly India helps job seekers find verified remote jobs for free and helps employers post jobs and hire faster.',
    contentUrl: `${R2}/workly-india-promo-30s-silent.mp4`,
    thumbnailUrl: 'https://pub-3225b45ecaf943b3b9061cd57d754bf2.r2.dev/02-Work-from-Home.png',
    uploadDate: '2026-10-20T00:00:00+05:30',
    duration: 'PT30S',
    cta: { label: 'Find jobs free', href: '/jobs' },
  },
  {
    slug: 'apply-free-candidates',
    title: 'How Job Seekers Apply Free on Workly India',
    description: 'See how a job seeker creates a free profile, applies to verified jobs at no cost and gets contacted directly by real employers on Workly India.',
    contentUrl: `${R2}/workly-india-apply-free-candidates-30s.mp4`,
    thumbnailUrl: 'https://pub-3225b45ecaf943b3b9061cd57d754bf2.r2.dev/02-Work-from-Home.png',
    uploadDate: '2026-10-20T00:00:00+05:30',
    duration: 'PT30S',
    cta: { label: 'Create free account', href: '/auth' },
  },
  {
    slug: 'hiring-solved',
    title: 'Hiring Solved: Find Candidates Fast with Workly India',
    description: 'See how employers post a job on Workly India and quickly receive applications from the right candidates across India.',
    contentUrl: `${R2}/workly-india-hiring-solved-30s.mp4`,
    thumbnailUrl: 'https://pub-3225b45ecaf943b3b9061cd57d754bf2.r2.dev/employee-introduction.jpg',
    uploadDate: '2026-10-20T00:00:00+05:30',
    duration: 'PT30S',
    cta: { label: 'Post a job free', href: '/post-job' },
  },
];

export const findVideo = (slug) => VIDEOS.find((v) => v.slug === slug) || null;
export const watchPath = (slug) => `/watch/${slug}`;

export function videoSchema(site, v) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: v.title,
    description: v.description,
    thumbnailUrl: [v.thumbnailUrl],
    uploadDate: v.uploadDate,
    duration: v.duration,
    contentUrl: v.contentUrl,
    embedUrl: `${site}${watchPath(v.slug)}`,
    inLanguage: 'en-IN',
    publisher: { '@type': 'Organization', name: 'Workly India', url: `${site}/` },
  };
}
