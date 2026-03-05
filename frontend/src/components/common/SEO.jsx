import { Helmet } from 'react-helmet-async';
import PropTypes from 'prop-types';

/**
 * SEO Component for managing meta tags
 * Uses react-helmet-async for server-side rendering support
 */
export function SEO({
  title,
  description,
  keywords,
  ogTitle,
  ogDescription,
  ogImage,
  ogUrl,
  canonical,
  noindex = false,
  schema,
  children,
}) {
  const siteName = 'Epochal Dialog';
  const defaultDescription = 'Epochal Dialog - платформа для общения с AI-агентами. Общайтесь с историческими личностями, мыслителями и персонажами с помощью искусственного интеллекта.';
  const defaultImage = 'https://epochaldialog.com/logo.webp';
  const defaultUrl = 'https://epochaldialog.com/';

  const metaDescription = description || defaultDescription;
  const metaTitle = title ? `${title} | ${siteName}` : siteName;
  const metaOgTitle = ogTitle || metaTitle;
  const metaOgDescription = ogDescription || metaDescription;
  const metaOgImage = ogImage || defaultImage;
  const metaOgUrl = ogUrl ? `${defaultUrl}${ogUrl}` : defaultUrl;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{metaTitle}</title>
      <meta name="description" content={metaDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="application-name" content={siteName} />
      <meta name="apple-mobile-web-app-title" content={siteName} />

      {/* Canonical URL */}
      <link rel="canonical" href={canonical ? `${defaultUrl}${canonical.replace(/^\//, '')}` : metaOgUrl} />

      {/* Robots */}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={metaOgUrl} />
      <meta property="og:title" content={metaOgTitle} />
      <meta property="og:description" content={metaOgDescription} />
      <meta property="og:image" content={metaOgImage} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="ru_RU" />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={metaOgUrl} />
      <meta property="twitter:title" content={metaOgTitle} />
      <meta property="twitter:description" content={metaOgDescription} />
      <meta property="twitter:image" content={metaOgImage} />
      <meta property="twitter:image:alt" content={metaOgTitle} />

      {/* Additional Meta Tags */}
      <meta name="author" content="Epochal Dialog" />
      <meta name="theme-color" content="#2d283e" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}

      {children}
    </Helmet>
  );
}

SEO.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  keywords: PropTypes.string,
  ogTitle: PropTypes.string,
  ogDescription: PropTypes.string,
  ogImage: PropTypes.string,
  ogUrl: PropTypes.string,
  canonical: PropTypes.string,
  noindex: PropTypes.bool,
  schema: PropTypes.object,
  children: PropTypes.node,
};

export default SEO;
