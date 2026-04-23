export function notFoundHandler(_req, res) {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
}

export function errorHandler(error, _req, res, _next) {
  console.error(error);

  const statusCode = error.statusCode ?? 500;
  const body = {
    success: false,
    message: error.message ?? "Internal server error"
  };

  // Surface machine-readable code when present (set by compliance guards) so
  // client apps can branch on COMPANY_SUSPENDED, CREDENTIAL_EXPIRED, etc.
  if (error.reasonCode) body.reasonCode = error.reasonCode;

  res.status(statusCode).json(body);
}
