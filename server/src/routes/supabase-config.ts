import { Router, type Request, type Response } from 'express';
import { getSupabaseCredentials } from '../storage/database/supabase-client.js';

const router = Router();

/**
 * GET /api/v1/supabase-config
 * Returns Supabase URL and anon key for frontend client initialization
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const { url, anonKey } = getSupabaseCredentials();
    if (!url || !anonKey) {
      res.status(500).json({ error: 'Supabase credentials not configured' });
      return;
    }
    res.json({ url, anonKey });
  } catch (error) {
    console.error('Failed to get Supabase config:', error);
    res.status(500).json({ error: 'Failed to get Supabase config' });
  }
});

export default router;
