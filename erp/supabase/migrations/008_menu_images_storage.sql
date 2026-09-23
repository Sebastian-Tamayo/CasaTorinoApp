-- =============================================================================
-- Casa Torino — Fotos de platos (carta web + TPV)
-- Migración 008: bucket público Storage `menu_images`
-- Copia alineada con web/supabase/008_menu_images_storage.sql
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu_images',
  'menu_images',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "menu_images_public_select" ON storage.objects;
CREATE POLICY "menu_images_public_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'menu_images');

DROP POLICY IF EXISTS "menu_images_auth_insert" ON storage.objects;
CREATE POLICY "menu_images_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'menu_images');

DROP POLICY IF EXISTS "menu_images_auth_update" ON storage.objects;
CREATE POLICY "menu_images_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'menu_images')
  WITH CHECK (bucket_id = 'menu_images');

DROP POLICY IF EXISTS "menu_images_auth_delete" ON storage.objects;
CREATE POLICY "menu_images_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'menu_images');
