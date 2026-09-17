import axios from 'axios';

export const TOKEN_KEY = 'industraflow.token';
export const USER_KEY = 'industraflow.user';

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Attach the stored JWT to every request.
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
});

// On 401 (except a failed login attempt) drop the session and go to /login.
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response ? error.response.status : null;
    const url = (error.config && error.config.url) || '';
    if (status === 401 && url.indexOf('/auth/login') === -1) {
      clearStoredAuth();
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    // Surface the backend's { error } message (or a readable fallback).
    const apiMessage =
      error.response && error.response.data && (error.response.data.error || error.response.data.message);
    return Promise.reject(new Error(apiMessage || error.message || 'Request failed'));
  }
);

export default axiosClient;

