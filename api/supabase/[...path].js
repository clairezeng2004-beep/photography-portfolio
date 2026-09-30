module.exports = async (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).json({ error: 'Supabase environment variables are not configured.' });
    return;
  }

  const { path, ...query } = req.query;
  const pathname = Array.isArray(path) ? path.join('/') : path || '';
  const search = new URLSearchParams(query).toString();
  const target = `${supabaseUrl.replace(/\/$/, '')}/${pathname}${search ? `?${search}` : ''}`;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': req.headers['content-type'] || 'application/json',
        Prefer: req.headers.prefer || '',
      },
      body: ['GET', 'HEAD'].includes(req.method || '') ? undefined : (
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
      ),
    });

    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(body);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Supabase proxy failed.' });
  }
};
