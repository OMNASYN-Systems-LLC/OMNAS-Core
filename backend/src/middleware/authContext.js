import { db } from "../config/db.js";

function getProjectId(req) {
  return req.params.projectId ?? req.query.projectId ?? req.body?.projectId ?? null;
}

async function hydrateOrgContext(req) {
  const { userId } = req.auth;

  const affiliationQuery = `
    SELECT wa.company_id
    FROM worker_affiliations wa
    WHERE wa.worker_user_id = $1 AND wa.status = 'ACTIVE'
    ORDER BY CASE wa.role WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END, wa.created_at ASC
    LIMIT 1
  `;

  const { rows } = await db.query(affiliationQuery, [userId]);
  const currentOrgId = rows[0]?.company_id ?? null;

  req.currentOrgId = currentOrgId;
  req.user = { ...(req.user ?? {}), companyId: currentOrgId };

  const projectId = getProjectId(req);
  if (!projectId || !currentOrgId) {
    req.projectRole = null;
    return;
  }

  const projectRoleQuery = `
    SELECT role
    FROM project_memberships
    WHERE project_id = $1 AND company_id = $2 AND status = 'ACTIVE'
    LIMIT 1
  `;

  const membership = await db.query(projectRoleQuery, [projectId, currentOrgId]);
  req.projectRole = membership.rows[0]?.role ?? null;
}

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

  return hydrateOrgContext(req)
    .then(() => next())
    .catch((error) => next(error));
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
