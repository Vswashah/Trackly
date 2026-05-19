const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { generateEmbedding } = require('../ai/embedding.service');

const processEmbeddingJobs = async () => {
  try {
    // Pick up to 5 pending jobs at a time
    const jobsRes = await db.query(
      `SELECT ej.id, ej.ticket_id, ej.attempts, ej.max_attempts,
              t.title, t.description
       FROM embedding_jobs ej
       JOIN tickets t ON t.id = ej.ticket_id
       WHERE ej.status = 'pending'
         AND ej.attempts < ej.max_attempts
       ORDER BY ej.scheduled_at ASC
       LIMIT 5`
    );

    for (const job of jobsRes.rows) {
      // Mark as processing
      await db.query(
        `UPDATE embedding_jobs
         SET status = 'processing', started_at = NOW(), attempts = attempts + 1
         WHERE id = $1`,
        [job.id]
      );

      try {
        // Generate embedding from title + description
        const text = `${job.title}\n\n${job.description || ''}`.trim();
        const embedding = await generateEmbedding(text);

        // Store vector in ticket
        await db.query(
          `UPDATE tickets SET embedding = $1 WHERE id = $2`,
          [`[${embedding.join(',')}]`, job.ticket_id]
        );

        // Mark job done
        await db.query(
          `UPDATE embedding_jobs
           SET status = 'done', completed_at = NOW(),
               token_count = $1, model_name = 'text-embedding-3-small'
           WHERE id = $2`,
          [Math.ceil(text.length / 4), job.id]
        );

        console.log(` Embedded ticket ${job.ticket_id}`);
      } catch (err) {
        // Mark job failed
        await db.query(
          `UPDATE embedding_jobs
           SET status = $1, error_message = $2
           WHERE id = $3`,
          [
            job.attempts >= job.max_attempts ? 'failed' : 'pending',
            err.message,
            job.id
          ]
        );
        console.error(` Embedding job failed for ticket ${job.ticket_id}:`, err);
      }
    }
  } catch (err) {
    console.error('Embedding worker error:', err);
  }
};

// Run every 30 seconds
const startEmbeddingWorker = () => {
  console.log('🔄 Embedding worker started');
  processEmbeddingJobs(); // run immediately on start
  setInterval(processEmbeddingJobs, 30000);
};

module.exports = { startEmbeddingWorker };