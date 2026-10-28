import { CONTACT_EMAIL } from "@/lib/public-information";
import { SITE_URL } from "@/lib/seo";

export const siteIdentity = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "GUMWHEEL",
      alternateName: "Gumwheel",
      url: `${SITE_URL}/`,
      inLanguage: "en-AU",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "GUMWHEEL",
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/brand/gumwheel-original.png`,
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: CONTACT_EMAIL,
        url: `${SITE_URL}/about#contact`,
      },
    },
  ],
};

export default function PublicSiteIdentity() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteIdentity).replace(/</g, "\\u003c") }} />;
}
