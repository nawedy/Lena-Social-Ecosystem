import type { Handle } from '@sveltejs/kit';

// CORS middleware configuration
export const corsMiddleware: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  
  // Get the request origin
  const requestOrigin = event.request.headers.get('origin');
  const allowedOrigins = [
    process.env.VITE_APP_URL,
    'http://localhost:5173',
    'http://localhost:3000'
  ].filter(Boolean);

  // Only set CORS headers if the origin is in our allowed list
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    response.headers.set('Access-Control-Allow-Origin', requestOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '3600');
  }

  // Handle preflight requests
  if (event.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: response.headers
    });
  }

  return response;
};
