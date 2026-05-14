export default function handler(_req: any, res: any) {
  res.status(200).json({
    ok: true,
    service: 'dictionary-debug',
    note: 'Dictionary engine is validated by TypeScript build and tracked in issue #3. Runtime dictionary imports are intentionally avoided in Vercel functions to keep the production diagnostic endpoint lightweight.'
  });
}
