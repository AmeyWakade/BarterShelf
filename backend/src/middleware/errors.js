export function notFound(_req, res) { res.status(404).json({ error: 'Route not found.' }); }

export function errorHandler(error, _req, res, _next) {
  if (error?.name === 'MulterError') return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Each image must be smaller than 8 MB.' : 'Invalid image upload.' });
  if (typeof error?.message === 'string' && error.message.startsWith('Only image files')) return res.status(400).json({ error: error.message });
  if (error?.code === 11000) return res.status(409).json({ error: 'An account with this email already exists.' });
  if (error?.name === 'ValidationError' || error?.name === 'CastError') return res.status(400).json({ error: error.message });
  if (error?.name === 'ZodError') return res.status(400).json({ error: error.issues.map(i => i.message).join(' ') });
  console.error(error);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
