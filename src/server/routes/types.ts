import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { UserRole } from "../../types";

// Shared contract for route modules split out of server.ts. Route modules
// receive server-scoped helpers (auth, rate limiting, validation) by injection
// instead of importing server.ts, so there is no circular dependency and the
// behaviour stays identical to the inline handlers they replaced.
export interface AuthenticatedRequest extends Request {
  actor?: {
    userId: string;
    tenantId: string;
    role: UserRole;
    displayName: string;
    email?: string;
    impersonatorId?: string;
    impersonationReadOnly?: boolean;
    impersonationExpiresAt?: number;
    mfa?: boolean;
    authTime?: number;
    emailVerified?: boolean;
  };
}

export interface RouteDeps {
  authenticate: (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;
  apiRateLimit: RequestHandler;
  cleanField: (value: unknown, max?: number) => string;
  persistVerifiedPayment: (event: any) => Promise<any>;
  assertFeature: (tenantId: string, key: string) => Promise<void>;
  canManageCourse: (...args: any[]) => boolean;
  normalizeAcademicPolicy: (...args: any[]) => any;
  recordProductEventSafe: (...args: any[]) => Promise<unknown>;
  reqLocale: (req: any) => any;
  validateFile: (file?: any) => void;
  MAX_ASSIGNMENT_FILES: number;
  MAX_TOTAL_FILE_BYTES: number;
}
