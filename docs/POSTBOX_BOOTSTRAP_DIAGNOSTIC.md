# Postbox bootstrap diagnostic

This temporary diagnostic makes the one-time AnnWord Postbox bootstrap publish a commit status linked to the exact GitHub Actions run. It logs only sanitized identity state and DNS record metadata; private DKIM material is never printed or uploaded.

Remove the temporary bootstrap and observer workflows after `annword.ru` is verified and the live weekly-report preflight is green.
