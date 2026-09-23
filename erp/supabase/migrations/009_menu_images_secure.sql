-- =============================================================================
-- Casa Torino — endurecer Storage menu_images (seguro + gratis)
-- Ejecutar en Supabase SQL Editor
-- =============================================================================
-- Modelo:
--   · Lectura pública (carta web)
--   · SIN escritura anon (evita que cualquiera suba con la anon key)
--   · Escritura: service role en el API /api/carta-image (servidor Vercel)
--     o, si no hay service role, el API guarda en ops_kv (mismo plan free)
-- =============================================================================

-- Quitar políticas abiertas de escritura anon (si se aplicó 008b)
DROP POLICY IF EXISTS "menu_images_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "menu_images_anon_update" ON storage.objects;
DROP POLICY IF EXISTS "menu_images_anon_delete" ON storage.objects;

-- Asegurar lectura pública
DROP POLICY IF EXISTS "menu_images_public_select" ON storage.objects;
CREATE POLICY "menu_images_public_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'menu_images');

-- Escritura solo authenticated (dashboard). El service_role bypasea RLS.
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

-- Opcional (recomendado): en Vercel → Settings → Environment Variables
-- añadir SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY) = secret del proyecto.
-- Nunca la pongas en el frontend ni en GitHub.
