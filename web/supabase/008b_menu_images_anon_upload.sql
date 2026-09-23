-- =============================================================================
-- Casa Torino — complemento fotos platos
-- Ejecutar si Vercel NO tiene SUPABASE_SERVICE_ROLE_KEY (solo ANON_KEY).
-- La puerta real de seguridad es POST /api/carta-image (sesión TPV / PIN).
-- =============================================================================

DROP POLICY IF EXISTS "menu_images_anon_insert" ON storage.objects;
CREATE POLICY "menu_images_anon_insert"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'menu_images');

DROP POLICY IF EXISTS "menu_images_anon_update" ON storage.objects;
CREATE POLICY "menu_images_anon_update"
  ON storage.objects FOR UPDATE
  TO anon
  USING (bucket_id = 'menu_images')
  WITH CHECK (bucket_id = 'menu_images');

DROP POLICY IF EXISTS "menu_images_anon_delete" ON storage.objects;
CREATE POLICY "menu_images_anon_delete"
  ON storage.objects FOR DELETE
  TO anon
  USING (bucket_id = 'menu_images');
