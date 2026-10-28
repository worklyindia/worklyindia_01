import { Helmet } from 'react-helmet-async';
import { CANONICAL_URL } from '@/config/domainConfig';

const SITE_URL = CANONICAL_URL;

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbStructuredDataProps {
  items: BreadcrumbItem[];
}

export const BreadcrumbStructuredData = ({ items }: BreadcrumbStructuredDataProps) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`
    }))
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

// Pre-built common breadcrumbs
export const JobsBreadcrumb = () => (
  <BreadcrumbStructuredData 
    items={[
      { name: 'Home', url: '/' },
      { name: 'Jobs', url: '/jobs' }
    ]} 
  />
);

export const JobDetailBreadcrumb = ({ jobTitle, jobUrl }: { jobTitle: string; jobUrl: string }) => (
  <BreadcrumbStructuredData 
    items={[
      { name: 'Home', url: '/' },
      { name: 'Jobs', url: '/jobs' },
      { name: jobTitle, url: jobUrl }
    ]} 
  />
);

export const BlogBreadcrumb = () => (
  <BreadcrumbStructuredData 
    items={[
      { name: 'Home', url: '/' },
      { name: 'Blog', url: '/blog' }
    ]} 
  />
);

export const BlogPostBreadcrumb = ({ postTitle, postUrl }: { postTitle: string; postUrl: string }) => (
  <BreadcrumbStructuredData 
    items={[
      { name: 'Home', url: '/' },
      { name: 'Blog', url: '/blog' },
      { name: postTitle, url: postUrl }
    ]} 
  />
);

export const CompanyBreadcrumb = ({ companyName, companyUrl }: { companyName: string; companyUrl: string }) => (
  <BreadcrumbStructuredData 
    items={[
      { name: 'Home', url: '/' },
      { name: 'Companies', url: '/company-directory' },
      { name: companyName, url: companyUrl }
    ]} 
  />
);

export default BreadcrumbStructuredData;
