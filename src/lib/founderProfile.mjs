export const FOUNDER_NAME = 'Vishalbhai Muljibhai Gohil';
export const FOUNDER_PHOTO_KEY = 'founder_photo_url';
export const DEFAULT_FOUNDER_PHOTO = '/founder-ceo.jpg';

export function founderSchema(site, photo = DEFAULT_FOUNDER_PHOTO) {
  const base = site.replace(/\/+$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${base}/#founder`,
    name: FOUNDER_NAME,
    jobTitle: 'Founder & CEO',
    image: new URL(photo || DEFAULT_FOUNDER_PHOTO, `${base}/`).href,
    url: `${base}/about-us#founder`,
    worksFor: { '@id': `${base}/#organization`, '@type': 'Organization', name: 'Workly India', url: `${base}/` },
  };
}