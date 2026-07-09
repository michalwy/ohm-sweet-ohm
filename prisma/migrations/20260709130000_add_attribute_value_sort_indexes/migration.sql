-- CreateIndex: composite indexes on PartAttributeValue to support
-- DB-level ORDER BY when sorting parts by a specific attribute value.
CREATE INDEX "PartAttributeValue_attributeId_quantityBaseValue_idx" ON "PartAttributeValue"("attributeId", "quantityBaseValue");

-- CreateIndex
CREATE INDEX "PartAttributeValue_attributeId_numberValue_idx" ON "PartAttributeValue"("attributeId", "numberValue");

-- CreateIndex
CREATE INDEX "PartAttributeValue_attributeId_displayValue_idx" ON "PartAttributeValue"("attributeId", "displayValue");
