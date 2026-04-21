export async function registerUser({ name, email }) {
  return {
    id: crypto.randomUUID(),
    name,
    email,
    createdAt: new Date().toISOString()
  };
}

export async function loginUser({ email }) {
  return {
    id: crypto.randomUUID(),
    email,
    token: "mock-jwt-token"
  };
}
