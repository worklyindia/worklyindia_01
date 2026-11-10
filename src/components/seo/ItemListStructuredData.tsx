import { Helmet } from 'react-helmet-async';
import { CANONICAL_URL } from '@/config/domainConfig';

const SITE_URL = CANONICAL_URL;

interface ListItem {
  position: number;
  name: string;
  url: string;
  image?: string;
  description?: string;
}

interface ItemListStructuredDataProps {
  name: string;
  description?: string;
  items: ListItem[];
  itemListOrder?: 'ItemListOrderAscending' | 'ItemListOrderDescending' | 'ItemListUnordered';
}

export const ItemListStructuredData = ({
  name,
  description,
  items,
  itemListOrder = 'ItemListOrderDescending'
}: ItemListStructuredDataProps) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": name,
    ...(description && { "description": description }),
    "itemListOrder": `https://schema.org/${itemListOrder}`,
    "numberOfItems": items.length,
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": item.position || index + 1,
      "item": {
        "@type": "Thing",
        "name": item.name,
        "url": item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
        ...(item.image && { "image": item.image.startsWith('http') ? item.image : `${SITE_URL}${item.image}` }),
        ...(item.description && { "description": item.description })
      }
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

// Specialized component for job listings
interface JobListItem {
  id: string;
  title: string;
  slug?: string;
  company_name?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
}

interface JobListStructuredDataProps {
  jobs: JobListItem[];
  listName?: string;
}

export const JobListStructuredData = ({
  jobs,
  listName = 'Remote Jobs in India'
}: JobListStructuredDataProps) => {
  const items: ListItem[] = jobs.map((job, index) => ({
    position: index + 1,
    name: job.title,
    url: `/job/${job.slug || job.id}`,
    description: job.company_name 
      ? `${job.title} at ${job.company_name}${job.location ? ` - ${job.location}` : ''}`
      : undefined
  }));

  return (
    <ItemListStructuredData
      name={listName}
      description="Latest remote job opportunities in India"
      items={items}
      itemListOrder="ItemListOrderDescending"
    />
  );
};

export default ItemListStructuredData;
