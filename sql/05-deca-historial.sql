-- ============================================================
-- DeCA Manager — Tabla de historial de modificaciones
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Crear tabla deca_historial
CREATE TABLE IF NOT EXISTS deca_historial (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deca_id uuid NOT NULL REFERENCES decas(id) ON DELETE CASCADE,
  version integer NOT NULL,
  campo text NOT NULL,
  valor_anterior text,
  valor_nuevo text,
  modificado_por uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- 2. Índice para consultas por deca_id
CREATE INDEX IF NOT EXISTS idx_deca_historial_deca_id ON deca_historial(deca_id);

-- 3. Habilitar RLS
ALTER TABLE deca_historial ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS

-- Admin puede ver todo el historial
CREATE POLICY "admin_select_historial" ON deca_historial
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND rol = 'admin' AND activo = true)
  );

-- Conductores pueden ver historial de sus propias DeCA
CREATE POLICY "conductor_select_historial" ON deca_historial
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM decas d
      JOIN profiles p ON p.id = d.conductor_id
      WHERE d.id = deca_historial.deca_id
        AND p.user_id = auth.uid()
        AND p.activo = true
    )
  );

-- Solo admin puede insertar historial (al editar una DeCA)
CREATE POLICY "admin_insert_historial" ON deca_historial
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND rol = 'admin' AND activo = true)
  );

-- Lectura pública para la página deca.html (QR de la Guardia Civil)
CREATE POLICY "public_select_historial" ON deca_historial
  FOR SELECT TO anon
  USING (true);

-- 5. Permisos de tabla
GRANT SELECT, INSERT ON deca_historial TO authenticated;
GRANT SELECT ON deca_historial TO anon;
