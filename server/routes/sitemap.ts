import type { Express } from "express";
import { storage } from "../storage";

export async function registerSitemapRoute(app: Express) {
  app.get('/sitemap.xml', async (_req, res) => {
    try {
      const baseUrl = 'https://leaseshieldapp.com';
      const staticUrls: { loc: string; changefreq: string; priority: string }[] = [
        { loc: '/', changefreq: 'weekly', priority: '1.0' },
        { loc: '/subscribe', changefreq: 'monthly', priority: '0.9' },
        { loc: '/screening/explain', changefreq: 'monthly', priority: '0.9' },
        { loc: '/screening-report-decoder', changefreq: 'monthly', priority: '0.9' },
        { loc: '/blog', changefreq: 'weekly', priority: '0.8' },
        { loc: '/help', changefreq: 'monthly', priority: '0.6' },
        { loc: '/contact', changefreq: 'monthly', priority: '0.5' },
        { loc: '/tx/tenant-selection-criteria', changefreq: 'monthly', priority: '0.7' },
        { loc: '/privacy', changefreq: 'yearly', priority: '0.3' },
        { loc: '/terms', changefreq: 'yearly', priority: '0.3' },
        { loc: '/refund-policy', changefreq: 'yearly', priority: '0.3' },
        { loc: '/disclaimers', changefreq: 'yearly', priority: '0.3' },
        { loc: '/login', changefreq: 'yearly', priority: '0.4' },
        { loc: '/signup', changefreq: 'yearly', priority: '0.6' },
      ];

      const posts = await storage.getAllBlogPosts({ isPublished: true });

      const escapeXml = (s: string) => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      const formatDate = (d: Date | string | null | undefined) => {
        if (!d) return undefined;
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return undefined;
        return dt.toISOString().split('T')[0];
      };

      const urlEntries: string[] = [];

      for (const u of staticUrls) {
        urlEntries.push(
          `  <url>\n    <loc>${baseUrl}${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
        );
      }

      for (const post of posts) {
        const lastmod = formatDate(post.updatedAt) || formatDate(post.publishedAt);
        const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
        urlEntries.push(
          `  <url>\n    <loc>${baseUrl}/blog/${escapeXml(post.slug)}</loc>${lastmodTag}\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`
        );
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries.join('\n')}\n</urlset>\n`;

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(200).send(xml);
    } catch (error) {
      console.error('Error generating sitemap.xml:', error);
      res.status(500).type('text/plain').send('Failed to generate sitemap');
    }
  });
}
