-- Insert new Permission records
INSERT INTO "Permission" ("key", "description", "createdAt") VALUES
  ('shopping-lists:read',   'Read shopping lists and their items in a workspace.',                                               NOW()),
  ('shopping-lists:write',  'Create, update, and delete shopping lists and items in a workspace.',                               NOW()),
  ('purchase-orders:read',  'Read purchase orders and their items in a workspace.',                                              NOW()),
  ('purchase-orders:write', 'Create, update, and delete purchase orders, mark as ordered, and receive items in a workspace.',    NOW())
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description";

-- Add all four permissions to existing editor system roles
INSERT INTO "RolePermission" ("roleId", "permissionKey", "createdAt")
SELECT r.id, p.key, NOW()
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."isSystem" = TRUE
  AND r."name" = 'editor'
  AND p."key" IN (
    'shopping-lists:read',
    'shopping-lists:write',
    'purchase-orders:read',
    'purchase-orders:write'
  )
ON CONFLICT DO NOTHING;

-- Add read permissions to existing reader system roles
INSERT INTO "RolePermission" ("roleId", "permissionKey", "createdAt")
SELECT r.id, p.key, NOW()
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."isSystem" = TRUE
  AND r."name" = 'reader'
  AND p."key" IN (
    'shopping-lists:read',
    'purchase-orders:read'
  )
ON CONFLICT DO NOTHING;
