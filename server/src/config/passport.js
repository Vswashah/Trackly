const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    const full_name = profile.displayName;
    const avatar_url = profile.photos[0]?.value;

    // Check if user already exists
    const existing = await db.query(
      `SELECT u.id, u.email, u.full_name, r.code as role_code
       FROM users u
       LEFT JOIN mst_roles r ON r.id = u.role_id
       WHERE u.email = $1 AND u.deleted_at IS NULL`,
      [email]
    );

    if (existing.rows.length > 0) {
      // User exists — update last login and return
      await db.query(
        `UPDATE users SET last_login_at = NOW(), avatar_url = $1 WHERE email = $2`,
        [avatar_url, email]
      );
      return done(null, existing.rows[0]);
    }

    // New user — create account
    const roleRes = await db.query(`SELECT id FROM mst_roles WHERE code = 'member'`);
    const roleId = roleRes.rows[0]?.id;
    const userId = uuidv4();

    await db.query(
      `INSERT INTO users (id, role_id, email, password_hash, full_name, avatar_url, is_email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [userId, roleId, email, 'google-oauth', full_name, avatar_url]
    );

    // Create preferences
    await db.query(
      `INSERT INTO user_preferences (id, user_id) VALUES ($1, $2)`,
      [uuidv4(), userId]
    );

    const newUser = { id: userId, email, full_name, role_code: 'member' };
    return done(null, newUser);
  } catch (err) {
    return done(err, null);
  }
}));

module.exports = passport;