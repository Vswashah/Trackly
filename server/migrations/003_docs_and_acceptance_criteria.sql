-- Structured acceptance criteria (Given/When/Then) on tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS acceptance_criteria TEXT;

-- PROJECT_DOCS — lightweight markdown wiki per project
CREATE TABLE IF NOT EXISTS project_docs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  content TEXT DEFAULT '',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_docs_project ON project_docs (project_id) WHERE deleted_at IS NULL;
