const normalizeEmail = (value = "") =>
  String(value).trim().toLowerCase();

const REQUIRED_BOOTSTRAP_ADMINS = [
  "2023-3-60-376@std.ewubd.edu",
  "ewucsc@ewubd.edu",
];

export const getConfiguredBootstrapAdminEmails = () =>
  new Set(
    [
      ...REQUIRED_BOOTSTRAP_ADMINS,
      ...(process.env.BOOTSTRAP_ADMIN_EMAILS || "").split(","),
    ]
      .map(normalizeEmail)
      .filter(Boolean),
  );

export const isBootstrapAdminEmail = (email = "") =>
  getConfiguredBootstrapAdminEmails().has(normalizeEmail(email));

export const requiresVerifiedFirebaseEmail = (user = {}) =>
  Boolean(user.emailVerificationRequired);

export const evaluateMemberLogin = ({
  user,
  firebaseEmailVerified = false,
} = {}) => {
  if (!user) {
    return { allowed: false, status: 404, code: "USER_NOT_FOUND" };
  }

  if (user.isActive === false) {
    return { allowed: false, status: 403, code: "ACCOUNT_INACTIVE" };
  }

  if (requiresVerifiedFirebaseEmail(user) && !firebaseEmailVerified) {
    return { allowed: false, status: 403, code: "EMAIL_NOT_VERIFIED" };
  }

  const approvalStatus = user.approvalStatus || "approved";

  if (approvalStatus === "pending") {
    return { allowed: false, status: 403, code: "PENDING_APPROVAL" };
  }

  if (approvalStatus === "rejected") {
    return { allowed: false, status: 403, code: "ACCOUNT_REJECTED" };
  }

  if (approvalStatus === "suspended") {
    return { allowed: false, status: 403, code: "ACCOUNT_SUSPENDED" };
  }

  return { allowed: true, status: 200, code: null };
};
