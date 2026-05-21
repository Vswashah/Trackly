require('dotenv').config();
const { startEmbeddingWorker } = require('./jobs/embedding.worker');
const db = require('./config/db');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://trackly-5pqbzz7qs-vishwaa-shah-s-projects.vercel.app',
    'https://trackly.vercel.app',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Test DB connection
db.query('SELECT NOW()').then(() => {
  console.log('✅ Database connection verified');
}).catch(err => {
  console.error('❌ Database connection failed:', err);
});

app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/projects/:projectId/tickets', require('./routes/ticket.routes'));
app.use('/api/v1/tickets/:ticketId/comments', require('./routes/comment.routes'));
app.use('/api/v1/ai', require('./routes/ai.routes'));

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Trackly API is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Trackly server running on port ${PORT}`);
});

startEmbeddingWorker();

module.exports = app;