import { useState } from "react";

const STORAGE_KEY = "omnas_auth_v1";

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuth(auth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useAuth() {
  const [auth, setAuth] = useState(() => getStoredAuth());

  function updateAuth(newAuth) {
    saveAuth(newAuth);
    setAuth(newAuth);
  }

  function logout() {
    clearAuth();
    setAuth(null);
  }

  return { auth, updateAuth, logout };
}
