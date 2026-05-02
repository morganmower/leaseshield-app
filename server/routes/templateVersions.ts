import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../jwtAuth";
import { getUserId } from "./_shared";

export async function registerTemplateVersionsRoutes(app: Express) {
  // Get template version history
  app.get("/api/templates/:id/versions", async (req, res) => {
    try {
      const { id } = req.params;
      
      const template = await storage.getTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const versions = await storage.getTemplateVersions(id);

      res.json({
        template: { id: template.id, title: template.title, currentVersion: template.version },
        versions,
      });
    } catch (error: any) {
      console.error("Error fetching template versions:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Restore a previous template version
  app.post("/api/templates/:id/restore-version/:versionId", isAuthenticated, async (req: any, res) => {
    try {
      const { id, versionId } = req.params;
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const template = await storage.getTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const versions = await storage.getTemplateVersions(id);
      const versionToRestore = versions.find(v => v.id.toString() === versionId);
      
      if (!versionToRestore) {
        return res.status(404).json({ message: "Version not found" });
      }

      // Create new version entry for the restoration
      const newVersionNumber = template.version ? template.version + 1 : 2;
      await storage.createTemplateVersion({
        templateId: id,
        versionNumber: newVersionNumber,
        pdfUrl: versionToRestore.pdfUrl,
        fillableFormData: versionToRestore.fillableFormData as any,
        versionNotes: `Restored from Version ${versionToRestore.versionNumber}`,
        lastUpdateReason: `Rollback to previous version ${versionToRestore.versionNumber}`,
        sourceReviewId: null,
        metadata: { restoredFrom: versionToRestore.id } as any,
        createdBy: userId,
      });

      // Update the template with the restored version's data
      await storage.updateTemplate(id, {
        version: newVersionNumber,
        pdfUrl: versionToRestore.pdfUrl,
        fillableFormData: versionToRestore.fillableFormData as any,
        versionNotes: `Restored from Version ${versionToRestore.versionNumber}`,
        lastUpdateReason: `Rollback to previous version ${versionToRestore.versionNumber}`,
      });

      res.json({ 
        success: true, 
        message: `Template restored to version ${versionToRestore.versionNumber}`,
        newVersion: newVersionNumber,
      });
    } catch (error: any) {
      console.error('Error restoring template version:', error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });
}
