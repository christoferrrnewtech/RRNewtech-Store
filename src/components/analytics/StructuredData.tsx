import { SITE } from "@/lib/constants";

/**
 * Site-wide JSON-LD: Organization/Store + WebSite (with sitelinks search box).
 * Product-level JSON-LD lives on each product page (ProductJsonLd).
 */
export function StructuredData() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "Store"],
        name: SITE.legalName,
        alternateName: SITE.name,
        url: SITE.url,
        logo: `${SITE.url}/icon.png`,
        email: SITE.email,
        telephone: SITE.phones[0].value,
        description: SITE.description,
        areaServed: { "@type": "Country", name: "Philippines" },
        sameAs: [SITE.socials.facebook, SITE.socials.instagram, SITE.socials.linkedin],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "sales",
          email: SITE.email,
          telephone: SITE.phones[0].value,
          areaServed: "PH",
          availableLanguage: ["English", "Filipino"],
        },
      },
      {
        "@type": "WebSite",
        url: SITE.url,
        name: SITE.name,
        description: SITE.description,
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE.url}/?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
