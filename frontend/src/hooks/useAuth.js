const SESSION_KEY = "omnas_session";
const USERS_KEY = "omnas_users";

// Read the current session from localStorage.
// Returns { userId, role, name, email } or null.
export function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Registered user store (email → { id, role, name }).
// Provides consistent userId across login/logout cycles.
export function getRegisteredUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function saveRegisteredUser(email, data) {
  const users = getRegisteredUsers();
  users[email] = data;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
