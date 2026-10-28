import { Helmet } from 'react-helmet-async';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQPageStructuredDataProps {
  faqs: FAQItem[];
}

export const FAQPageStructuredData = ({ faqs }: FAQPageStructuredDataProps) => {
  if (!faqs || faqs.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
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

export default FAQPageStructuredData;
