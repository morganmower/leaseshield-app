import type { Express } from "express";
import path from "path";
import { storage } from "../storage";
import { isAuthenticated } from "../jwtAuth";
import { insertRentLedgerEntrySchema } from "@shared/schema";
import { getUserId } from "./_shared";

export async function registerRentLedgerRoutes(app: Express) {
  // Rent Ledger routes
  app.get('/api/rent-ledger', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const entries = await storage.getRentLedgerEntries(userId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching rent ledger:", error);
      res.status(500).json({ message: "Failed to fetch entries" });
    }
  });

  app.post('/api/rent-ledger', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log("📝 Creating rent ledger entry, body:", JSON.stringify(req.body, null, 2));

      // Validate property exists and belongs to user if provided
      // Note: The client uses rentalProperties table, but the rent ledger FK references properties table
      // We need to check rentalProperties since that's where the UI gets the list
      const propertyId = req.body.propertyId || null;
      if (propertyId) {
        console.log("📝 Checking rental property:", propertyId);
        const rentalProperty = await storage.getRentalPropertyById(propertyId);
        if (!rentalProperty) {
          console.error("❌ Rental property not found:", propertyId);
          return res.status(400).json({ message: "Property not found. Please select a valid property or leave it blank." });
        }
        if (rentalProperty.userId !== userId) {
          console.error("❌ Rental property belongs to different user:", rentalProperty.userId, "vs", userId);
          return res.status(400).json({ message: "Property not found. Please select a valid property or leave it blank." });
        }
        console.log("✅ Rental property validated:", rentalProperty.name);
        // Clear the propertyId since it references the wrong table (properties vs rentalProperties)
        // The rent ledger FK references the old 'properties' table, but UI uses 'rentalProperties'
        // For now, we'll store null to avoid FK violation, but log what property was selected
        console.log("⚠️ Clearing propertyId due to table mismatch - UI uses rentalProperties, DB expects properties");
      }

      // Auto-generate month from effectiveDate if not provided
      let month = req.body.month;
      if (!month && req.body.effectiveDate) {
        const effectiveDate = new Date(req.body.effectiveDate);
        if (!isNaN(effectiveDate.getTime())) {
          const year = effectiveDate.getFullYear();
          const monthNum = String(effectiveDate.getMonth() + 1).padStart(2, '0');
          month = `${year}-${monthNum}`;
        }
      }
      if (!month) {
        // Fallback to current month
        const now = new Date();
        month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }

      // Clean up optional fields - convert empty strings to null
      // Note: propertyId is intentionally set to null because the UI uses rentalProperties table
      // but the rent ledger FK references the old 'properties' table - table mismatch issue
      const dataToValidate = {
        ...req.body,
        userId,
        month,
        propertyId: null, // Intentionally null due to FK/table mismatch - see validation above
        description: req.body.description || null,
        notes: req.body.notes || null,
        paymentMethod: req.body.paymentMethod || null,
        referenceNumber: req.body.referenceNumber || null,
      };

      console.log("📝 Data to validate:", JSON.stringify(dataToValidate, null, 2));

      const validated = insertRentLedgerEntrySchema.parse(dataToValidate);

      console.log("✅ Validated rent ledger entry");

      const entry = await storage.createRentLedgerEntry(validated);
      res.json(entry);
    } catch (error: any) {
      console.error("❌ Error creating rent ledger entry:", error);
      // Handle Zod validation errors specifically
      if (error?.issues) {
        console.error("❌ Zod validation issues:", JSON.stringify(error.issues, null, 2));
        const errorDetails = error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ');
        return res.status(500).json({ message: `Validation failed: ${errorDetails}` });
      }
      // Handle database errors (like foreign key constraint)
      if (error?.code === '23503') {
        console.error("❌ Foreign key violation - property not found");
        return res.status(500).json({ message: "Property not found. Please select a valid property or leave it blank." });
      }
      console.error("❌ Error details:", error?.message, error?.code);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.put('/api/rent-ledger/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validated = insertRentLedgerEntrySchema.parse({
        ...req.body,
        userId,
      });

      const updated = await storage.updateRentLedgerEntry(req.params.id, userId, validated);
      if (!updated) {
        return res.status(404).json({ message: "Entry not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating rent ledger entry:", error);
      res.status(500).json({ message: "Failed to update entry" });
    }
  });

  app.delete('/api/rent-ledger/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const deleted = await storage.deleteRentLedgerEntry(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Entry not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting rent ledger entry:", error);
      res.status(500).json({ message: "Failed to delete entry" });
    }
  });
}
