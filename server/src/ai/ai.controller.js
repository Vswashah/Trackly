const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { generateEmbedding } = require('./embedding.service');
const Anthropic = require('@anthropic-ai/sdk').default;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const llm = async (prompt) => {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].text;
};

// ── POST /ai/similar ──────────────────────────────────────────────
exports.findSimilar = async (req, res) => {
  const { text, project_id, exclude_ticket_id } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  try {
    const embedding = await generateEmbedding(text);
    const vectorStr = `[${embedding.join(',')}]`;

    const params = [vectorStr, project_id];
    let excludeClause = '';
    if (exclude_ticket_id) {
      params.push(exclude_ticket_id);
      excludeClause = `AND t.id != $${params.length}`;
    }

    const result = await db.query(
  `SELECT t.id, t.ticket_key, t.title, t.description,
          s.code as status,
          1 - (t.embedding <=> $1::vector) as similarity
   FROM tickets t
   LEFT JOIN mst_ticket_status s ON s.id = t.status_id
   WHERE t.project_id = $2
     AND t.embedding IS NOT NULL
     AND t.is_deleted = false
     ${exclude_ticket_id ? 'AND t.id != $3' : ''}
   ORDER BY t.embedding <=> $1::vector
   LIMIT 3`,
  exclude_ticket_id
    ? [vectorStr, project_id, exclude_ticket_id]
    : [vectorStr, project_id]
);

    await db.query(
      `INSERT INTO ai_interactions
        (id, user_id, interaction_type, input_text, tokens_used)
       VALUES ($1, $2, 'duplicate_check', $3, $4)`,
      [uuidv4(), req.user.id, text, Math.ceil(text.length / 4)]
    );

    return res.status(200).json({
      similar: result.rows.filter(r => parseFloat(r.similarity) > 0.5),
    });
  } catch (err) {
    console.error('Find similar error:', err);
    return res.status(503).json({ error: 'AI service unavailable', detail: err.message });
  }
};

// ── GET /ai/hints/:ticketId ───────────────────────────────────────
exports.getHints = async (req, res) => {
  const { ticketId } = req.params;

  try {
    const ticketRes = await db.query(
      `SELECT t.id, t.ticket_key, t.title, t.description, t.embedding
       FROM tickets t
       WHERE t.ticket_key = $1 AND t.is_deleted = false`,
      [ticketId]
    );
    if (!ticketRes.rows.length) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = ticketRes.rows[0];
    if (!ticket.embedding) {
      return res.status(400).json({
        error: 'Ticket not embedded yet. Wait 30 seconds and try again.'
      });
    }

    // Find top 5 similar resolved tickets
    const similarRes = await db.query(
      `SELECT t.ticket_key, t.title, t.description,
              1 - (t.embedding <=> $1::vector) as similarity
       FROM tickets t
       JOIN mst_ticket_status s ON s.id = t.status_id
       WHERE t.embedding IS NOT NULL
         AND t.is_deleted = false
         AND s.is_terminal = true
         AND t.id != $2
       ORDER BY t.embedding <=> $1::vector
       LIMIT 5`,
      [ticket.embedding, ticket.id]
    );

    if (!similarRes.rows.length) {
      return res.status(200).json({
        hints: 'No similar resolved tickets found yet. Be the first to resolve this type of issue!',
        similar_resolved: [],
        interaction_id: null,
      });
    }

    const context = similarRes.rows.map((t, i) =>
      `${i + 1}. [${t.ticket_key}] ${t.title}\n   ${t.description || 'No description'}`
    ).join('\n\n');

    const prompt = `You are a helpful engineering assistant. A developer has this ticket:

Title: ${ticket.title}
Description: ${ticket.description || 'No description'}

Similar resolved tickets:
${context}

Based on these, provide 2-3 concise bullet point resolution hints. Be specific and actionable. Max 150 words.`;

    const hints = await llm(prompt);

    const interactionRes = await db.query(
      `INSERT INTO ai_interactions
        (id, ticket_id, user_id, interaction_type, input_text, output_text, similarity_score)
       VALUES ($1, $2, $3, 'resolution_hint', $4, $5, $6)
       RETURNING id`,
      [uuidv4(), ticket.id, req.user.id, ticket.title, hints,
       similarRes.rows[0]?.similarity || 0]
    );

    return res.status(200).json({
      hints,
      similar_resolved: similarRes.rows,
      interaction_id: interactionRes.rows[0].id,
    });
  } catch (err) {
    console.error('Get hints error:', err);
    return res.status(503).json({ error: 'AI service unavailable', detail: err.message });
  }
};

// ── POST /ai/summarize/:ticketId ──────────────────────────────────
exports.summarize = async (req, res) => {
  const { ticketId } = req.params;

  try {
    const ticketRes = await db.query(
      `SELECT t.id, t.ticket_key, t.title, t.description
       FROM tickets t WHERE t.ticket_key = $1 AND t.is_deleted = false`,
      [ticketId]
    );
    if (!ticketRes.rows.length) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const ticket = ticketRes.rows[0];

    const commentsRes = await db.query(
      `SELECT c.body, u.full_name FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.ticket_id = $1 AND c.is_deleted = false
       ORDER BY c.created_at ASC`,
      [ticket.id]
    );

    const commentText = commentsRes.rows
      .map(c => `${c.full_name}: ${c.body}`)
      .join('\n');

    const prompt = `Summarize this ticket in exactly 3 bullet points. Be concise and technical.

Title: ${ticket.title}
Description: ${ticket.description || 'No description'}
${commentText ? `\nComments:\n${commentText}` : ''}

3 bullet points: (1) what the issue is, (2) impact/reproduction, (3) current status or next steps.`;

    const summary = await llm(prompt);

    const interactionRes = await db.query(
      `INSERT INTO ai_interactions
        (id, ticket_id, user_id, interaction_type, input_text, output_text)
       VALUES ($1, $2, $3, 'summary', $4, $5)
       RETURNING id`,
      [uuidv4(), ticket.id, req.user.id, ticket.title, summary]
    );

    return res.status(200).json({
      summary,
      interaction_id: interactionRes.rows[0].id,
    });
  } catch (err) {
    console.error('Summarize error:', err);
    return res.status(503).json({ error: 'AI service unavailable', detail: err.message });
  }
};

// ── POST /ai/suggest-priority ─────────────────────────────────────
exports.suggestPriority = async (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    const prompt = `Classify the priority of this software ticket.

Title: ${title}
Description: ${description || 'No description'}

Priority levels:
- p0 (Critical): Production down, data loss, security breach
- p1 (High): Major feature broken, affects many users
- p2 (Medium): Feature partially broken, workaround exists
- p3 (Low): Minor issue, cosmetic bug

Respond ONLY with valid JSON, no markdown, no explanation:
{"priority": "p1", "confidence": 0.88, "reason": "one sentence"}`;

    const raw = await llm(prompt);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const interactionRes = await db.query(
      `INSERT INTO ai_interactions
        (id, user_id, interaction_type, input_text, output_text)
       VALUES ($1, $2, 'priority_suggest', $3, $4)
       RETURNING id`,
      [uuidv4(), req.user.id, title, raw]
    );

    return res.status(200).json({
      ...parsed,
      interaction_id: interactionRes.rows[0].id,
    });
  } catch (err) {
    console.error('Suggest priority error:', err);
    return res.status(503).json({ error: 'AI service unavailable', detail: err.message });
  }
};

// ── POST /ai/search ───────────────────────────────────────────────
exports.searchTickets = async (req, res) => {
  const { query, project_id } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });

  try {
    const prompt = `You parse a natural language ticket search query into structured filters.

Query: "${query}"

Respond ONLY with valid JSON, no markdown, no explanation:
{"priority": "p1"|null, "status": "open"|"in_progress"|"in_review"|"done"|"cancelled"|null, "type": "bug"|"feature"|"task"|"chore"|null, "semantic_query": "the core search phrase"}`;

    const raw = await llm(prompt);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const embedding = await generateEmbedding(parsed.semantic_query || query);
    const vectorStr = `[${embedding.join(',')}]`;

    const params = [vectorStr, project_id];
    const conditions = [
      't.project_id = $2',
      't.embedding IS NOT NULL',
      't.is_deleted = false',
    ];

    if (parsed.status) {
      params.push(parsed.status);
      conditions.push(`s.code = $${params.length}`);
    }
    if (parsed.priority) {
      params.push(parsed.priority);
      conditions.push(`p.code = $${params.length}`);
    }
    if (parsed.type) {
      params.push(parsed.type);
      conditions.push(`ty.code = $${params.length}`);
    }

    const result = await db.query(
      `SELECT t.ticket_key, t.title, t.description,
              s.code as status, p.code as priority,
              a.full_name as assignee_name,
              1 - (t.embedding <=> $1::vector) as similarity
       FROM tickets t
       LEFT JOIN mst_ticket_status s ON s.id = t.status_id
       LEFT JOIN mst_ticket_priority p ON p.id = t.priority_id
       LEFT JOIN mst_ticket_type ty ON ty.id = t.type_id
       LEFT JOIN users a ON a.id = t.assignee_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.embedding <=> $1::vector
       LIMIT 10`,
      params
    );

    await db.query(
      `INSERT INTO ai_interactions
        (id, user_id, interaction_type, input_text, output_text, tokens_used)
       VALUES ($1, $2, 'nl_search', $3, $4, $5)`,
      [uuidv4(), req.user.id, query, raw, Math.ceil(query.length / 4)]
    );

    return res.status(200).json({
      results: result.rows,
      parsed_filters: parsed,
    });
  } catch (err) {
    console.error('Search tickets error:', err);
    return res.status(503).json({ error: 'AI service unavailable', detail: err.message });
  }
};

// ── POST /ai/feedback/:interactionId ─────────────────────────────
exports.submitFeedback = async (req, res) => {
  const { interactionId } = req.params;
  const { was_helpful } = req.body;

  if (was_helpful === undefined) {
    return res.status(400).json({ error: 'was_helpful is required' });
  }

  try {
    const result = await db.query(
      `UPDATE ai_interactions SET was_helpful = $1 WHERE id = $2 RETURNING id`,
      [was_helpful, interactionId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Interaction not found' });
    }
    return res.status(200).json({ message: 'Feedback recorded' });
  } catch (err) {
    console.error('Feedback error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};