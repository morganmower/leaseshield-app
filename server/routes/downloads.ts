import type { Express } from "express";
import path from "path";

export async function registerDownloadsRoutes(app: Express) {
  // Download logos endpoint
  app.get('/api/download/logos/:filename', async (req, res) => {
    const filename = req.params.filename;
    if (!filename.match(/^leaseshield-logo-(horizontal|stacked)\.jpg$/)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join('attached_assets', filename);
    try {
      res.download(filePath);
    } catch (error) {
      res.status(404).json({ error: 'File not found' });
    }
  });
}
