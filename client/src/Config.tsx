import axios from "axios";

// Get the API URL from environment variable or determine based on current environment
const getApiUrl = () => {
  // First check for explicit environment variable (set this in Vercel)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // If no env var is set, determine based on current domain
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    
    // For localhost development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000';
    }
    
    // For production - REPLACE THIS WITH YOUR ACTUAL BACKEND URL
    // Example: return 'https://your-backend-app.vercel.app';
    return 'https://online-cloakshare-server.vercel.app'; // Update this with your actual backend URL
  }
  
  // Fallback
  return 'http://localhost:8000';
};

const baseURL = getApiUrl();
const apiBaseURL = baseURL.endsWith('/api') ? baseURL : `${baseURL}/api`;

console.log('🌐 API Base URL:', apiBaseURL);

const getData = async (url: string, customHeaders = {}) => {
  const headers = {
    ...customHeaders,
  };
  const response = await axios.get(`${apiBaseURL}/${url}`, { headers: headers });
  return response.data;
};

const postData = async (url: string, body: any, options:any) => {
  
  const response = await axios.post(`${apiBaseURL}/${url}`, body, options);
  return response.data;
};

export { getData, postData };
