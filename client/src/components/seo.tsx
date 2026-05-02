import { useEffect } from "react";

const SITE_NAME = "LeaseShield";
const SITE_URL = "https://leaseshieldapp.com";

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
 * SEO component — additively updates document head per page.
 * Falls back to the static index.html tags when unmounted (does not reset),
 * so navigating to a page without SEO leaves the previous title in place.
 * That's acceptable: every public page should render its own <SEO /> tag.
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

    if (description) {
      setMetaContent("name", "description", description);
      setMetaContent("property", "og:description", description);
      setMetaContent("name", "twitter:description", description);
    }

    setMetaContent("property", "og:title", fullTitle);
    setMetaContent("name", "twitter:title", fullTitle);

    const canonicalUrl = canonical
      ? canonical.startsWith("http")
        ? canonical
        : `${SITE_URL}${canonical}`
      : `${SITE_URL}${window.location.pathname}`;
    setLinkRel("canonical", canonicalUrl);
    setMetaContent("property", "og:url", canonicalUrl);

    if (ogImage) {
      const fullImg = ogImage.startsWith("http")
        ? ogImage
        : `${SITE_URL}${ogImage}`;
      setMetaContent("property", "og:image", fullImg);
      setMetaContent("name", "twitter:image", fullImg);
    }

    if (noIndex) {
      setMetaContent("name", "robots", "noindex,nofollow");
    } else {
      setMetaContent("name", "robots", "index,follow");
    }
  }, [title, description, canonical, ogImage, noIndex]);

  return null;
}
