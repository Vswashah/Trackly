-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- MST_TICKET_STATUS
CREATE TABLE IF NOT EXISTS mst_ticket_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  color_hex VARCHAR(7),
  sort_order INTEGER DEFAULT 0,
  is_terminal BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MST_TICKET_PRIORITY
CREATE TABLE IF NOT EXISTS mst_ticket_priority (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  color_hex VARCHAR(7),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MST_TICKET_TYPE
CREATE TABLE IF NOT EXISTS mst_ticket_type (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MST_ROLES
CREATE TABLE IF NOT EXISTS mst_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('system', 'org', 'project')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MST_PERMISSIONS
CREATE TABLE IF NOT EXISTS mst_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(100) UNIQUE NOT NULL,
  label VARCHAR(150) NOT NULL,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MST_NOTIFICATION_TYPE
CREATE TABLE IF NOT EXISTS mst_notification_type (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  template TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MST_CHANGE_TYPE
CREATE TABLE IF NOT EXISTS mst_change_type (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MST_VISIBILITY
CREATE TABLE IF NOT EXISTS mst_visibility (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MST_RELATION_TYPE
CREATE TABLE IF NOT EXISTS mst_relation_type (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  inverse_code VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- SEED MASTER DATA
-- =====================

-- Ticket statuses
INSERT INTO mst_ticket_status (code, label, color_hex, sort_order, is_terminal) VALUES
  ('open',        'Open',        '#6B7280', 1, FALSE),
  ('in_progress', 'In Progress', '#3B82F6', 2, FALSE),
  ('in_review',   'In Review',   '#F59E0B', 3, FALSE),
  ('done',        'Done',        '#10B981', 4, TRUE),
  ('cancelled',   'Cancelled',   '#EF4444', 5, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Ticket priorities
INSERT INTO mst_ticket_priority (code, label, color_hex, sort_order) VALUES
  ('p0', 'Critical', '#EF4444', 1),
  ('p1', 'High',     '#F59E0B', 2),
  ('p2', 'Medium',   '#3B82F6', 3),
  ('p3', 'Low',      '#6B7280', 4)
ON CONFLICT (code) DO NOTHING;

-- Ticket types
INSERT INTO mst_ticket_type (code, label, icon) VALUES
  ('bug',     'Bug',     'bug'),
  ('feature', 'Feature', 'star'),
  ('chore',   'Chore',   'settings'),
  ('spike',   'Spike',   'zap'),
  ('task',    'Task',    'check-square')
ON CONFLICT (code) DO NOTHING;

-- Roles
INSERT INTO mst_roles (code, label, scope) VALUES
  ('system_admin',   'System Admin',   'system'),
  ('org_owner',      'Org Owner',      'org'),
  ('org_admin',      'Org Admin',      'org'),
  ('project_owner',  'Project Owner',  'project'),
  ('project_admin',  'Project Admin',  'project'),
  ('member',         'Member',         'project'),
  ('viewer',         'Viewer',         'project')
ON CONFLICT (code) DO NOTHING;

-- Visibility levels
INSERT INTO mst_visibility (code, label) VALUES
  ('public',   'Public'),
  ('internal', 'Internal'),
  ('private',  'Private')
ON CONFLICT (code) DO NOTHING;

-- Change types
INSERT INTO mst_change_type (code, label) VALUES
  ('field_change',      'Field Change'),
  ('status_change',     'Status Change'),
  ('assignment',        'Assignment'),
  ('label_added',       'Label Added'),
  ('label_removed',     'Label Removed'),
  ('comment_added',     'Comment Added'),
  ('attachment_added',  'Attachment Added'),
  ('sprint_changed',    'Sprint Changed')
ON CONFLICT (code) DO NOTHING;

-- Notification types
INSERT INTO mst_notification_type (code, label, template) VALUES
  ('assigned',       'Assigned to ticket',    '{{actor}} assigned you to {{ticket_key}}'),
  ('mentioned',      'Mentioned in comment',  '{{actor}} mentioned you in {{ticket_key}}'),
  ('commented',      'New comment',           '{{actor}} commented on {{ticket_key}}'),
  ('status_changed', 'Status changed',        '{{actor}} changed status of {{ticket_key}} to {{new_value}}'),
  ('due_soon',       'Due soon',              '{{ticket_key}} is due in 24 hours')
ON CONFLICT (code) DO NOTHING;

-- Relation types
INSERT INTO mst_relation_type (code, label, inverse_code) VALUES
  ('blocks',          'Blocks',           'is_blocked_by'),
  ('is_blocked_by',   'Is blocked by',    'blocks'),
  ('duplicates',      'Duplicates',       'is_duplicate_of'),
  ('is_duplicate_of', 'Is duplicate of',  'duplicates'),
  ('relates_to',      'Relates to',       'relates_to'),
  ('is_cloned_from',  'Is cloned from',   NULL)
ON CONFLICT (code) DO NOTHING;