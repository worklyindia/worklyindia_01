import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { CANONICAL_URL } from "@/config/domainConfig";
import { getRouteSeo } from "@/lib/routeSeo";

// Static index.html tags otherwise duplicate Helmet's, so Google kept showing the homepage description everywhere.
const STATIC_SELECTORS = [
  'meta[name="description"]', 'meta[name="title"]', 'meta[name="keywords"]',
  'meta[property="og:title"]', 'meta[property="og:description"]', 'meta[property="og:url"]',
  'meta[name="twitter:title"]', 'meta[name="twitter:description"]', 'meta[name="twitter:url"]',
  'link[rel="canonical"]',
];

export default function RouteSEO() {
  const { pathname } = useLocation();
  const seo = getRouteSeo(pathname);

  useEffect(() => {
    STATIC_SELECTORS.forEach((s) =>
      document.head.querySelectorAll(`${s}:not([data-rh])`).forEach((el) => el.remove()),
    );
  }, [pathname]);

  if (!seo) return null;
  const path = pathname.replace(/\/+$/, "") || "/";
  const url = `${CANONICAL_URL}${path === "/" ? "/" : path}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": seo.type ?? "WebPage",
    name: seo.title,
    description: seo.description,
    url,
    inLanguage: "en-IN",
    isPartOf: { "@type": "WebSite", name: "Workly India", url: `${CANONICAL_URL}/` },
  };
  const crumbs = path === "/" ? null : {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${CANONICAL_URL}/` },
      { "@type": "ListItem", position: 2, name: seo.title.split(/ [-|] /)[0], item: url },
    ],
  };

  return (
    <Helmet prioritizeSeoTags>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta name="keywords" content={seo.keywords} />
      {seo.robots && <meta name="robots" content={seo.robots} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
      {crumbs && <script type="application/ld+json">{JSON.stringify(crumbs)}</script>}
    </Helmet>
  );
}
