import { useEffect } from "react";

const SITE_NAME = "LeaseShield";
const SITE_URL = "https://leaseshieldapp.com";
const DEFAULT_DESCRIPTION =
  "LeaseShield helps small landlords stay legally compliant with state-specific leases, notices, and screening tools. $10/month, cancel anytime.";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image-v2.png`;

interface SEOProps {
  title: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noIndex?: boolean;
}

function setMetaContent(
  attr: "name" | "property",
  key: string,
  value: string,
) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setLinkRel(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * SEO component - updates document head per page.
 * Always writes every meta tag (using sensible defaults when props are absent)
 * so optional fields like description/og:image never carry over stale values
 * from a previously-rendered page.
 */
export function SEO({
  title,
  description,
  canonical,
  ogImage,
  noIndex,
}: SEOProps) {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME)
      ? title
      : `${title} | ${SITE_NAME}`;

    document.title = fullTitle;

    const effectiveDescription = description || DEFAULT_DESCRIPTION;
    setMetaContent("name", "description", effectiveDescription);
    setMetaContent("property", "og:description", effectiveDescription);
    setMetaContent("name", "twitter:description", effectiveDescription);

    setMetaContent("property", "og:title", fullTitle);
    setMetaContent("name", "twitter:title", fullTitle);
    setMetaContent("property", "og:site_name", SITE_NAME);
    setMetaContent("property", "og:type", "website");
    setMetaContent("name", "twitter:card", "summary_large_image");

    const canonicalUrl = canonical
      ? canonical.startsWith("http")
        ? canonical
        : `${SITE_URL}${canonical}`
      : `${SITE_URL}${window.location.pathname}`;
    setLinkRel("canonical", canonicalUrl);
    setMetaContent("property", "og:url", canonicalUrl);

    const effectiveImage = ogImage
      ? ogImage.startsWith("http")
        ? ogImage
        : `${SITE_URL}${ogImage}`
      : DEFAULT_OG_IMAGE;
    setMetaContent("property", "og:image", effectiveImage);
    setMetaContent("name", "twitter:image", effectiveImage);

    setMetaContent(
      "name",
      "robots",
      noIndex ? "noindex,nofollow" : "index,follow",
    );
  }, [title, description, canonical, ogImage, noIndex]);

  return null;
}
