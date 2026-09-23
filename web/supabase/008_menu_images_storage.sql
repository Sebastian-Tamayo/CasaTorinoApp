-- =============================================================================
-- Casa Torino — Fotos de platos (carta web + TPV)
-- Migración 008: bucket público Storage `menu_images`
-- Ejecutar en: Supabase → SQL Editor (proyecto del local)
-- =============================================================================

-- Bucket público: la web muestra las URLs sin autenticación.
-- La subida/borrado la hace el API del TPV con service role (no hace falta
-- política INSERT para anon). Políticas abajo: lectura pública + escritura
-- autenticada por si se usa el dashboard o el SDK con sesión.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu_images',
  'menu_images',
  true,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lectura pública (carta web)
DROP POLICY IF EXISTS "menu_images_public_select" ON storage.objects;
CREATE POLICY "menu_images_public_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'menu_images');

-- Escritura / borrado: roles autenticados (opcional; el API usa service role
-- y bypasa RLS). Útil si alguien sube desde el dashboard con login.
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

-- URL pública de un objeto:
--   {SUPABASE_URL}/storage/v1/object/public/menu_images/{path}
-- Ejemplo path: colombia-tamal-valluno/1727000000000.jpg
