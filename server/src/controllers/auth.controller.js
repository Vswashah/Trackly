const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/db');

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role_code },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN }
  );
  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
  );
  return { accessToken, refreshToken };
};

const setRefreshCookie = (res, token) => {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// POST /auth/register
exports.register = async (req, res) => {
  const { email, password, full_name } = req.body;

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'email, password and full_name are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // Check if email exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    // Get default member role
    const roleRes = await db.query("SELECT id FROM mst_roles WHERE code = 'member'");
    const roleId = roleRes.rows[0]?.id;

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Insert user
    const userRes = await db.query(
      `INSERT INTO users (id, role_id, email, password_hash, full_name)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role_id`,
      [uuidv4(), roleId, email.toLowerCase().trim(), passwordHash, full_name.trim()]
    );
    const user = userRes.rows[0];

    // Create user preferences
await db.query(
  `INSERT INTO user_preferences (id, user_id) VALUES ($1, $2)`,
  [uuidv4(), user.id]
);

// Auto-create a default project for new users
const projectId = uuidv4();
const userSlug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');

await db.query(
  `INSERT INTO projects (id, owner_id, name, slug, visibility_id)
   VALUES ($1, $2, $3, $4, (SELECT id FROM mst_visibility WHERE code = 'private'))`,
  [projectId, user.id, `${full_name.trim()}'s Project`, `${userSlug}-project`]
);

  // Add owner as project member
  await db.query(
    `INSERT INTO map_project_members (id, project_id, user_id, role_id, joined_at)
    VALUES ($1, $2, $3, (SELECT id FROM mst_roles WHERE code = 'project_owner'), NOW())`,
    [uuidv4(), projectId, user.id]
  );
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({ ...user, role_code: 'member' });

    // Store refresh token hash in user_sessions
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await db.query(
      `INSERT INTO user_sessions (id, user_id, refresh_token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days')`,
      [uuidv4(), user.id, tokenHash, req.ip, req.headers['user-agent']]
    );

    setRefreshCookie(res, refreshToken);

    return res.status(201).json({
      access_token: accessToken,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: 'member' },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    // Find user with role
    const userRes = await db.query(
      `SELECT u.id, u.email, u.full_name, u.password_hash, u.is_active,
              r.code as role_code
       FROM users u
       LEFT JOIN mst_roles r ON r.id = u.role_id
       WHERE u.email = $1 AND u.deleted_at IS NULL`,
      [email.toLowerCase().trim()]
    );

    const user = userRes.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Store session
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await db.query(
      `INSERT INTO user_sessions (id, user_id, refresh_token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days')`,
      [uuidv4(), user.id, tokenHash, req.ip, req.headers['user-agent']]
    );

    // Update last login
    await db.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      access_token: accessToken,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role_code },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /auth/me
exports.me = async (req, res) => {
  try {
    const userRes = await db.query(
      `SELECT u.id, u.email, u.full_name, u.avatar_url, u.timezone,
              r.code as role,
              p.theme, p.default_project_view, p.email_notifications, p.in_app_notifications
       FROM users u
       LEFT JOIN mst_roles r ON r.id = u.role_id
       LEFT JOIN user_preferences p ON p.user_id = u.id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [req.user.id]
    );

    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.status(200).json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      timezone: user.timezone,
      role: user.role,
      preferences: {
        theme: user.theme,
        default_project_view: user.default_project_view,
        email_notifications: user.email_notifications,
        in_app_notifications: user.in_app_notifications,
      },
    });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /auth/refresh
exports.refresh = async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Find valid sessions for this user
    const sessions = await db.query(
      `SELECT id, refresh_token_hash FROM user_sessions
       WHERE user_id = $1 AND is_revoked = false AND expires_at > NOW()`,
      [decoded.id]
    );

    // Check if any session matches
    let matchedSession = null;
    for (const session of sessions.rows) {
      const match = await bcrypt.compare(refreshToken, session.refresh_token_hash);
      if (match) { matchedSession = session; break; }
    }

    if (!matchedSession) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Get user with role
    const userRes = await db.query(
      `SELECT u.id, u.email, u.full_name, r.code as role_code
       FROM users u LEFT JOIN mst_roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [decoded.id]
    );
    const user = userRes.rows[0];

    const { accessToken } = generateTokens(user);
    return res.status(200).json({ access_token: accessToken });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
};

// POST /auth/logout
exports.logout = async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;

  try {
    if (refreshToken) {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      const sessions = await db.query(
        `SELECT id, refresh_token_hash FROM user_sessions
         WHERE user_id = $1 AND is_revoked = false`,
        [decoded.id]
      );
      for (const session of sessions.rows) {
        const match = await bcrypt.compare(refreshToken, session.refresh_token_hash);
        if (match) {
          await db.query(`UPDATE user_sessions SET is_revoked = true WHERE id = $1`, [session.id]);
          break;
        }
      }
    }
  } catch (_) {}

  res.clearCookie('refresh_token');
  return res.status(200).json({ message: 'Logged out' });
};