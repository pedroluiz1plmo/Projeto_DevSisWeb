ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS dados JSONB NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO systems (name, slug, description)
VALUES
  ('Call of Cthulhu', 'call-of-cthulhu', 'Investigação e horror cósmico.'),
  ('Dungeons & Dragons', 'dungeons-and-dragons', 'Fantasia medieval e aventura.'),
  ('Vampiro: A Máscara', 'vampiro-a-mascara', 'Crônicas do Mundo das Trevas.')
ON CONFLICT (slug) DO NOTHING;
