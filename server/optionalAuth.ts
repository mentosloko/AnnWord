import type { NextFunction, Response } from "express";
import { findUserById, readBearerOrCookieToken, verifySessionToken, type AuthenticatedRequest } from "./auth";

/**
 * Resolves a valid AnnWord session when present, but keeps anonymous requests
 * anonymous. Invalid or expired client tokens are never allowed to supply a
 * user id through the request body.
 */
export async function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readBearerOrCookieToken(req);
    const payload = token ? verifySessionToken(token) : null;
    req.user = payload ? await findUserById(payload.sub) || undefined : undefined;
  } catch (error) {
    console.warn("Optional auth resolution failed", error);
    req.user = undefined;
  }
  next();
}
