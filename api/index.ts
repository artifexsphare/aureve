/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import app from '../server/app.ts';

// Standard Vercel Serverless Function entrypoint
export default function handler(req: any, res: any) {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  return app(req, res);
}
