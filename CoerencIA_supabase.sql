-- CoerêncIA — Execute este script no Supabase SQL Editor
-- Menu lateral > SQL Editor > New query > cole aqui > Run

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  setor TEXT,
  idade INTEGER,
  genero TEXT,
  formacao TEXT,
  pos_graduacao TEXT,
  tempo_profissao INTEGER,
  tempo_instituicao INTEGER,
  turno TEXT,
  carga_horaria INTEGER,
  vinculo TEXT,
  cargo TEXT,
  estado_civil TEXT,
  filhos BOOLEAN,
  consentimento BOOLEAN DEFAULT FALSE,
  data_consentimento TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id TEXT REFERENCES usuarios(id),
  data_sessao TIMESTAMPTZ DEFAULT NOW(),
  r1 INTEGER, r2 INTEGER, r3 INTEGER, r4 INTEGER, r5 INTEGER,
  r6 INTEGER, r7 INTEGER, r8 INTEGER, r9 INTEGER, r10 INTEGER,
  r11 INTEGER, r12 INTEGER, r13 INTEGER,
  compreensibilidade INTEGER,
  maneabilidade INTEGER,
  significancia INTEGER,
  soc_total INTEGER,
  classificacao TEXT,
  dimensao_foco TEXT,
  diagnostico TEXT
);

CREATE TABLE IF NOT EXISTS bemestar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id TEXT REFERENCES usuarios(id),
  sessao_id UUID REFERENCES sessoes(id),
  data_avaliacao TIMESTAMPTZ DEFAULT NOW(),
  fisico INTEGER,
  emocional INTEGER,
  social INTEGER,
  espiritual INTEGER,
  intelectual INTEGER,
  ocupacional INTEGER,
  ambiental INTEGER,
  financeiro INTEGER
);

-- Permitir que o app leia e grave dados (necessário para funcionar)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bemestar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acesso_publico_usuarios" ON usuarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acesso_publico_sessoes"  ON sessoes  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acesso_publico_bemestar" ON bemestar FOR ALL USING (true) WITH CHECK (true);
