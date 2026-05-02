import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireAccess } from "../jwtAuth";
import { shortToken, getUserId } from "./_shared";

export async function registerRentalPropertiesRoutes(app: Express) {

  // ============================================================
  // RENTAL APPLICATION SYSTEM - API Routes
  // ============================================================

  // Import default templates from schema
  const { defaultCoverPageTemplate, defaultFieldSchemaTemplate } = await import("@shared/schema");

  // Rental Property CRUD
  app.get('/api/rental/properties', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const properties = await storage.getRentalPropertiesByUserId(userId);
      res.json(properties);
    } catch (error) {
      console.error("Error getting rental properties:", error);
      res.status(500).json({ message: "Failed to get properties" });
    }
  });

  app.get('/api/rental/properties/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const property = await storage.getRentalProperty(req.params.id, userId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      console.error("Error getting rental property:", error);
      res.status(500).json({ message: "Failed to get property" });
    }
  });

  app.post('/api/rental/properties', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { name, address, city, state, zipCode, propertyType, notes, defaultCoverPageJson, defaultFieldSchemaJson, requiredDocumentTypes, autoScreening, screeningInvitationId, propertyTermsJson } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Property name is required" });
      }

      const lengthChecks: Array<[string, unknown, number]> = [
        ['state', state, 2],
        ['zipCode', zipCode, 10],
        ['propertyType', propertyType, 50],
        ['screeningInvitationId', screeningInvitationId, 100],
      ];
      for (const [field, value, max] of lengthChecks) {
        if (typeof value === 'string' && value.length > max) {
          return res.status(400).json({
            message: `${field} is too long (max ${max} characters, got ${value.length}).`,
            field,
          });
        }
      }

      const property = await storage.createRentalProperty({
        userId,
        name,
        address: address || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        propertyType: propertyType || null,
        notes: notes || null,
        defaultCoverPageJson: defaultCoverPageJson || defaultCoverPageTemplate,
        defaultFieldSchemaJson: defaultFieldSchemaJson || defaultFieldSchemaTemplate,
        requiredDocumentTypes: requiredDocumentTypes || null,
        autoScreening: autoScreening ?? false,
        screeningInvitationId: screeningInvitationId || null,
        propertyTermsJson: propertyTermsJson || null,
      });

      res.status(201).json(property);
    } catch (error: any) {
      console.error("Error creating rental property:", {
        userId: getUserId(req),
        body: req.body,
        error,
      });
      const raw = error?.cause?.message || error?.message || String(error);
      const detail = raw.replace(/^Database operation failed:\s*/, '');
      res.status(500).json({
        message: `Failed to create property: ${detail}`,
      });
    }
  });

  app.patch('/api/rental/properties/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { name, address, city, state, zipCode, propertyType, notes, defaultCoverPageJson, defaultFieldSchemaJson, requiredDocumentTypes, autoScreening, screeningInvitationId, propertyTermsJson } = req.body;

      // Validate column-length constraints up front so the client gets a
      // human-readable 400 instead of a generic 500 on Postgres overflow.
      const lengthChecks: Array<[string, unknown, number]> = [
        ['state', state, 2],
        ['zipCode', zipCode, 10],
        ['propertyType', propertyType, 50],
        ['screeningInvitationId', screeningInvitationId, 100],
      ];
      for (const [field, value, max] of lengthChecks) {
        if (typeof value === 'string' && value.length > max) {
          return res.status(400).json({
            message: `${field} is too long (max ${max} characters, got ${value.length}).`,
            field,
          });
        }
      }

      const property = await storage.updateRentalProperty(req.params.id, userId, {
        name,
        address,
        city,
        state,
        zipCode,
        propertyType,
        notes,
        defaultCoverPageJson,
        defaultFieldSchemaJson,
        requiredDocumentTypes,
        autoScreening,
        screeningInvitationId: screeningInvitationId || null,
        propertyTermsJson,
      });

      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      res.json(property);
    } catch (error: any) {
      // Log the full error server-side AND return the underlying message so
      // we can diagnose the next failure instead of guessing. handleDbOperation
      // wraps the original error; we strip its "Database operation failed:" prefix.
      console.error("Error updating rental property:", {
        userId: getUserId(req),
        propertyId: req.params.id,
        body: req.body,
        error,
      });
      const raw = error?.cause?.message || error?.message || String(error);
      const detail = raw.replace(/^Database operation failed:\s*/, '');
      res.status(500).json({
        message: `Failed to update property: ${detail}`,
      });
    }
  });

  app.delete('/api/rental/properties/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteRentalProperty(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting rental property:", error);
      res.status(500).json({ message: "Failed to delete property" });
    }
  });

  // Rental Unit CRUD
  app.get('/api/rental/properties/:propertyId/units', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      // Verify property ownership
      const property = await storage.getRentalProperty(req.params.propertyId, userId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      const units = await storage.getRentalUnitsByPropertyId(req.params.propertyId);
      res.json(units);
    } catch (error) {
      console.error("Error getting rental units:", error);
      res.status(500).json({ message: "Failed to get units" });
    }
  });

  // Create application link at property level - reuses existing unit and link if available
  app.post('/api/rental/properties/:propertyId/quick-link', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const property = await storage.getRentalProperty(req.params.propertyId, userId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Check for existing units
      const existingUnits = await storage.getRentalUnitsByPropertyId(req.params.propertyId);
      
      let unit;
      let unitCreated = false;
      
      if (existingUnits.length > 0) {
        // Use the first existing unit
        unit = existingUnits[0];
        
        // Check if this unit already has an active link
        const existingLinks = await storage.getRentalApplicationLinksByUnitId(unit.id);
        const activeLink = existingLinks.find(l => l.isActive);
        
        if (activeLink) {
          // Update the existing link with latest property terms, then return it
          const currentSchema = activeLink.mergedSchemaJson as any || {};
          const updatedPropertyTerms = property.propertyTermsJson || {};
          const updatedCoverPage = property.defaultCoverPageJson || currentSchema.coverPage;
          const updatedMergedSchema = {
            ...currentSchema,
            coverPage: updatedCoverPage,
            propertyTerms: updatedPropertyTerms,
            propertyName: property.name,
          };
          await storage.updateRentalApplicationLink(activeLink.id, { mergedSchemaJson: updatedMergedSchema });
          return res.status(200).json({ unit, link: { ...activeLink, mergedSchemaJson: updatedMergedSchema }, unitCreated: false, reused: true });
        }
      } else {
        // Create a default unit silently (user doesn't need to see it)
        unit = await storage.createRentalUnit({
          propertyId: req.params.propertyId,
          unitLabel: "", // Empty label - shows property name only
          coverPageOverrideEnabled: false,
          coverPageOverrideJson: null,
          fieldSchemaOverrideEnabled: false,
          fieldSchemaOverrideJson: null,
        });
        unitCreated = true;
      }

      // Create the application link
      const publicToken = shortToken();
      const coverPage = property.defaultCoverPageJson;
      const fieldSchema = property.defaultFieldSchemaJson;
      
      // Get property terms from the property's stored data
      const propertyTerms = property.propertyTermsJson || {};

      // Format rent as currency string for display
      const formattedRent = unit.rentAmount ? `$${(unit.rentAmount / 100).toLocaleString()}/mo` : null;
      const updatedPropertyTerms = {
        ...propertyTerms,
        ...(formattedRent && { monthlyRent: formattedRent }),
      };
      
      const link = await storage.createRentalApplicationLink({
        unitId: unit.id,
        publicToken,
        mergedSchemaJson: { coverPage, fieldSchema, propertyName: property.name, unitLabel: unit.unitLabel || "", propertyTerms: updatedPropertyTerms, rentAmount: unit.rentAmount },
        isActive: true,
        expiresAt: null,
      });

      res.status(201).json({ unit, link, unitCreated });
    } catch (error) {
      console.error("Error creating quick link:", error);
      res.status(500).json({ message: "Failed to create application link" });
    }
  });

  app.post('/api/rental/properties/:propertyId/units', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      // Verify property ownership
      const property = await storage.getRentalProperty(req.params.propertyId, userId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      const { unitLabel, coverPageOverrideEnabled, coverPageOverrideJson, fieldSchemaOverrideEnabled, fieldSchemaOverrideJson, createLink } = req.body;

      const unit = await storage.createRentalUnit({
        propertyId: req.params.propertyId,
        unitLabel: unitLabel || "",
        coverPageOverrideEnabled: coverPageOverrideEnabled || false,
        coverPageOverrideJson: coverPageOverrideJson || null,
        fieldSchemaOverrideEnabled: fieldSchemaOverrideEnabled || false,
        fieldSchemaOverrideJson: fieldSchemaOverrideJson || null,
      });

      // If createLink is true, also create an application link for this unit
      let link = null;
      if (createLink) {
        const publicToken = shortToken();
        
        // Compute merged schema from property defaults (unit has no overrides yet)
        const coverPage = property.defaultCoverPageJson;
        const fieldSchema = property.defaultFieldSchemaJson;
        const propertyTerms = property.propertyTermsJson || {};
        
        // Format rent as currency string for display
        const formattedRent = unit.rentAmount ? `$${(unit.rentAmount / 100).toLocaleString()}/mo` : null;
        const updatedPropertyTerms = {
          ...propertyTerms,
          ...(formattedRent && { monthlyRent: formattedRent }),
        };
        
        link = await storage.createRentalApplicationLink({
          unitId: unit.id,
          publicToken,
          mergedSchemaJson: { coverPage, fieldSchema, propertyName: property.name, unitLabel: unit.unitLabel || "", propertyTerms: updatedPropertyTerms, rentAmount: unit.rentAmount },
          isActive: true,
          expiresAt: null,
        });
      }

      res.status(201).json({ unit, link });
    } catch (error) {
      console.error("Error creating rental unit:", error);
      res.status(500).json({ message: "Failed to create unit" });
    }
  });

  app.patch('/api/rental/units/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      // Get the unit first to verify ownership via property
      const existingUnit = await storage.getRentalUnit(req.params.id);
      if (!existingUnit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      
      // Verify property ownership
      const property = await storage.getRentalProperty(existingUnit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { unitLabel, rentAmount, coverPageOverrideEnabled, coverPageOverrideJson, fieldSchemaOverrideEnabled, fieldSchemaOverrideJson } = req.body;
      
      const unit = await storage.updateRentalUnit(req.params.id, {
        unitLabel,
        rentAmount,
        coverPageOverrideEnabled,
        coverPageOverrideJson,
        fieldSchemaOverrideEnabled,
        fieldSchemaOverrideJson,
      });

      // Update active links with new unit label and rent amount
      if (unit && (unitLabel !== undefined || rentAmount !== undefined)) {
        try {
          const links = await storage.getRentalApplicationLinksByUnitId(req.params.id);
          const activeLinks = links.filter(l => l.isActive);
          
          for (const link of activeLinks) {
            const currentSchema = link.mergedSchemaJson as any || {};
            const currentPropertyTerms = currentSchema.propertyTerms || {};
            
            const formattedRent = rentAmount !== undefined && rentAmount !== null
              ? `$${(rentAmount / 100).toLocaleString()}/mo`
              : currentPropertyTerms.monthlyRent;
            
            const updatedSchema = {
              ...currentSchema,
              ...(unitLabel !== undefined && { unitLabel: unitLabel || "" }),
              ...(rentAmount !== undefined && { rentAmount }),
              propertyTerms: {
                ...currentPropertyTerms,
                ...(rentAmount !== undefined && { monthlyRent: formattedRent }),
              },
            };
            await storage.updateRentalApplicationLink(link.id, { mergedSchemaJson: updatedSchema });
          }
          console.log(`[Unit Update] Synced ${activeLinks.length} active link(s) for unit ${req.params.id}`);
        } catch (linkSyncError) {
          console.error(`[Unit Update] Failed to sync links for unit ${req.params.id}:`, linkSyncError);
        }
      }

      res.json(unit);
    } catch (error) {
      console.error("Error updating rental unit:", error);
      res.status(500).json({ message: "Failed to update unit" });
    }
  });

  app.delete('/api/rental/units/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      // Get the unit first to verify ownership via property
      const existingUnit = await storage.getRentalUnit(req.params.id);
      if (!existingUnit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      
      // Verify property ownership
      const property = await storage.getRentalProperty(existingUnit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteRentalUnit(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting rental unit:", error);
      res.status(500).json({ message: "Failed to delete unit" });
    }
  });

  // Application Link Management
  app.get('/api/rental/units/:unitId/links', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      // Verify ownership via unit -> property
      const unit = await storage.getRentalUnit(req.params.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      const links = await storage.getRentalApplicationLinksByUnitId(req.params.unitId);
      res.json(links);
    } catch (error) {
      console.error("Error getting application links:", error);
      res.status(500).json({ message: "Failed to get links" });
    }
  });

  app.post('/api/rental/units/:unitId/links', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      // Verify ownership via unit -> property
      const unit = await storage.getRentalUnit(req.params.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if this unit already has an active link - update and reuse it with latest property terms
      const existingLinks = await storage.getRentalApplicationLinksByUnitId(req.params.unitId);
      const activeLink = existingLinks.find(l => l.isActive);
      if (activeLink) {
        // Update the existing link with latest property terms from the property
        const currentSchema = activeLink.mergedSchemaJson as any || {};
        const updatedPropertyTerms = property.propertyTermsJson || {};
        const updatedCoverPage = property.defaultCoverPageJson || currentSchema.coverPage;
        const updatedMergedSchema = {
          ...currentSchema,
          coverPage: updatedCoverPage,
          propertyTerms: updatedPropertyTerms,
          propertyName: property.name,
        };
        await storage.updateRentalApplicationLink(activeLink.id, { mergedSchemaJson: updatedMergedSchema });
        return res.status(200).json({ ...activeLink, mergedSchemaJson: updatedMergedSchema });
      }

      // Merge schemas: unit overrides or property defaults
      const coverPage = unit.coverPageOverrideEnabled && unit.coverPageOverrideJson 
        ? unit.coverPageOverrideJson 
        : property.defaultCoverPageJson;
      const fieldSchema = unit.fieldSchemaOverrideEnabled && unit.fieldSchemaOverrideJson
        ? unit.fieldSchemaOverrideJson
        : property.defaultFieldSchemaJson;

      // Generate public token
      const publicToken = shortToken();

      // Get property terms from property (fall back to request body for backwards compatibility)
      const propertyTerms = property.propertyTermsJson || req.body.propertyTerms || {};

      // Format rent as currency string for display
      const formattedRent = unit.rentAmount ? `$${(unit.rentAmount / 100).toLocaleString()}/mo` : null;
      const updatedPropertyTerms = {
        ...propertyTerms,
        ...(formattedRent && { monthlyRent: formattedRent }),
      };
      
      const link = await storage.createRentalApplicationLink({
        unitId: req.params.unitId,
        publicToken,
        mergedSchemaJson: { coverPage, fieldSchema, propertyName: property.name, unitLabel: unit.unitLabel, propertyTerms: updatedPropertyTerms, rentAmount: unit.rentAmount },
        isActive: true,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      });

      res.status(201).json(link);
    } catch (error) {
      console.error("Error creating application link:", error);
      res.status(500).json({ message: "Failed to create link" });
    }
  });

  app.post('/api/rental/links/:id/deactivate', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      await storage.deactivateRentalApplicationLink(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deactivating link:", error);
      res.status(500).json({ message: "Failed to deactivate link" });
    }
  });
}
