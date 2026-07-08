export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    message: 'mTLS proxy is running',
    endpoint: '/api/mtls'
  });
}
