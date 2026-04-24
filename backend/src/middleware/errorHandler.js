export function notFoundHandler(_req, res) {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
}

export function errorHandler(error, _req, res, _next) {
  console.error(error);

  const statusCode = error.statusCode ?? 500;
  const message = error.message ?? "Internal server error";
  const reasonCode = error.reasonCode ?? null;

  res.status(statusCode).json({
    success: false,
    message,
    ...(reasonCode ? { reasonCode } : {})
  });
}
