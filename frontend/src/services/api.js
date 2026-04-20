const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function request(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export function register(payload) {
  return request("/auth/register", payload);
}

export function login(payload) {
  return request("/auth/login", payload);
}
