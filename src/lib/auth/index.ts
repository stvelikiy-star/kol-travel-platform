export {
  createAuthError,
  createNotAuthenticatedError,
  createNotAuthorizedError,
  createOwnershipError,
  createProfileInactiveError,
  createProfileNotFoundError,
  createSafeServerError
} from "@/lib/auth/errors";
export {
  requireClientBookingOwnership,
  requireClientOrderOwnership,
  requireCourierDeliveryAccess,
  requirePartnerAvailabilityOwnership,
  requirePartnerBookingOwnership,
  requirePartnerCatalogOwnership,
  requirePartnerOrderOwnership
} from "@/lib/auth/ownership";
export { getCurrentUserProfile, requireActiveProfile } from "@/lib/auth/profile";
export {
  adminRoles,
  appRoles,
  partnerRoles,
  requireAdmin,
  requireClient,
  requireCourier,
  requirePartner,
  requireRole,
  requireSuperAdmin,
  userRoles
} from "@/lib/auth/roles";
export { getCurrentSession, requireAuthenticatedUser } from "@/lib/auth/session";
export type {
  AppRole,
  UserRole
} from "@/lib/auth/roles";
export type {
  AuthHelperResult,
  AuthProfile,
  AuthProfileStatus,
  AuthSessionUser,
  OwnershipCheck,
  OwnershipCheckResult,
  SafeAuthError,
  SafeAuthErrorCode
} from "@/lib/auth/types";

export { isAuthProtectionEnabled } from "@/lib/auth/protection";
export { protectRoute } from "@/lib/auth/route-guards";
export type { ProtectedArea } from "@/lib/auth/route-guards";
