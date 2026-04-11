import express from 'express';

const router = express.Router();

const GOOGLE_TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';
const MAX_TEXTS_PER_REQUEST = 128; // Google Translate API limit

/**
 * POST /api/translate
 * Body: { texts: string[], targetLanguage: string, sourceLanguage?: string }
 * Response: { translations: string[] }
 */
router.post('/', async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

    if (!apiKey) {
      return res.status(503).json({ error: 'Translation service not configured' });
    }

    const { texts, targetLanguage, sourceLanguage = 'en' } = req.body;

    // Input validation
    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: 'texts must be a non-empty array' });
    }

    if (typeof targetLanguage !== 'string' || !targetLanguage.trim()) {
      return res.status(400).json({ error: 'targetLanguage is required' });
    }

    if (texts.length > MAX_TEXTS_PER_REQUEST) {
      return res.status(400).json({
        error: `Too many texts. Maximum ${MAX_TEXTS_PER_REQUEST} per request.`,
      });
    }

    // Sanitize and validate text items
    const sanitizedTexts = texts.map((t) => {
      if (typeof t !== 'string') throw new Error('All items in texts must be strings');
      return t;
    });

    const payload = JSON.stringify({
      q: sanitizedTexts,
      target: targetLanguage.trim(),
      source: sourceLanguage.trim(),
      format: 'text',
    });

    const url = `${GOOGLE_TRANSLATE_API_URL}?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Google Translate API error:', response.status, errorBody);
      return res.status(502).json({ error: 'Translation provider error' });
    }

    const data = await response.json();
    const translations = data?.data?.translations?.map((t) => t.translatedText) ?? [];

    return res.json({ translations });
  } catch (err) {
    console.error('Translation route error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
