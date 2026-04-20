export function assertRequiredFields(payload, fields) {
  const missing = fields.filter((field) => payload[field] === undefined || payload[field] === null || payload[field] === "");

  if (missing.length > 0) {
    const error = new Error(`Missing required fields: ${missing.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
}

export function assertIntegerInRange(value, field, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    const error = new Error(`${field} must be an integer between ${min} and ${max}`);
    error.statusCode = 400;
    throw error;
  }
}

export function assertNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    const error = new Error(`${field} must be a non-negative integer`);
    error.statusCode = 400;
    throw error;
  }
}
