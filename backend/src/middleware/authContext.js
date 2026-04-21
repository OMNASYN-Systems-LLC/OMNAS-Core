export function requireAuth(req, res, next) {
  const userId = req.header("x-user-id");
  const role = req.header("x-user-role");

  if (!userId || !role) {
    return res.status(401).json({
      success: false,
      message: "Missing authentication headers"
    });
  }

  req.auth = { userId, role };
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
