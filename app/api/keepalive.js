export default async function handler(req, res) {
  const response = await fetch(
    'https://wzzvahevprmwigtiriyr.supabase.co/rest/v1/pto_settings?limit=1',
    {
      headers: {
        apikey: 'sb_publishable_g6xudK0xCihfdQi5t-AbgA_XqqtexPN',
        Authorization: 'Bearer sb_publishable_g6xudK0xCihfdQi5t-AbgA_XqqtexPN',
      },
    }
  );
  res.status(response.ok ? 200 : 500).json({ ok: response.ok });
}
