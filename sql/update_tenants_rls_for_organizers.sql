-- Allow organizers to view tenants that they are linked to (PENDING, ACTIVE, REJECTED)
-- ensuring they can see the profile data even before approval.

DROP POLICY IF EXISTS "Organizers can view linked tenants" ON tenants;

CREATE POLICY "Organizers can view linked tenants" ON tenants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_organizers
      WHERE tenant_organizers.tenant_id = tenants.id
      AND tenant_organizers.organizer_id IN (
        SELECT id FROM organizers WHERE profile_id = auth.uid()
      )
    )
  );
