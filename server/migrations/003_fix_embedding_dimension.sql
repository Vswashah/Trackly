-- The embedding worker uses Xenova/all-MiniLM-L6-v2, which produces 384-dim
-- vectors, but tickets.embedding was declared as vector(1536). This mismatch
-- made every embedding insert fail ("expected 1536 dimensions, not 384"), so
-- no embeddings were ever stored and all pgvector similarity features were
-- broken. Align the column with the model's output dimension.

DROP INDEX IF EXISTS idx_tickets_embedding;

ALTER TABLE tickets ALTER COLUMN embedding TYPE vector(384);

CREATE INDEX IF NOT EXISTS idx_tickets_embedding
  ON tickets USING hnsw (embedding vector_cosine_ops);
