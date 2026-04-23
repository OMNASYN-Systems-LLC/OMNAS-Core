const PROJECT_ROLE_MAP = {
  worker:         "field_worker",
  contractor:     "project_manager",
  superintendent: "superintendent",
  client:         "owner_read_only"
};

export function requireAuth(req, res, next) {
  const userId    = req.header("x-user-id");
  const role      = req.header("x-user-role");
  const companyId = req.header("x-company-id") ?? null;

  if (!userId || !role) {
    return res.status(401).json({
      success: false,
      message: "Missing authentication headers"
    });
  }

  req.auth = {
    userId,
    role,
    companyId,
    projectRole: PROJECT_ROLE_MAP[role] ?? role
  };

  // Convenience aliases used by compliance and company guards.
  req.currentOrgId   = companyId;
  req.user           = { id: userId, role, companyId };

  return next();
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions"
      });
    }

    return next();
  };
}
