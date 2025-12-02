// functions/api/geocode.js
// This function acts as a proxy to bypass CORS issues during local development.

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const lat = url.searchParams.get('lat');
  const lon = url.searchParams.get('lon');

  if (!lat || !lon) {
    return new Response(JSON.stringify({ error: 'Latitude and longitude are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Set a User-Agent, as some services require it.
  const headers = {
    'User-Agent': 'ExplosionSim/1.0 (Cloudflare Worker Proxy)',
    'Accept': 'application/json',
  };

  try {
    // 1. Try Nominatim first
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1&namedetails=1&accept-language=en`;
    const nominatimResponse = await fetch(nominatimUrl, { headers });

    if (nominatimResponse.ok) {
      const data = await nominatimResponse.json();
      // Add CORS headers to the response to allow localhost to access it
      const responseHeaders = {
        'Access-Control-Allow-Origin': '*', // Allow any origin
        'Content-Type': 'application/json',
      };
      return new Response(JSON.stringify(data), { headers: responseHeaders });
    }
    // If Nominatim fails, log it and fall through to the next service.
    console.warn(`Nominatim failed with status: ${nominatimResponse.status}`);

  } catch (e) {
    console.error('Error fetching from Nominatim:', e.message);
  }

  try {
    // 2. Fallback to Open-Meteo
    const openMeteoUrl = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en`;
    const openMeteoResponse = await fetch(openMeteoUrl, { headers });

    if (openMeteoResponse.ok) {
      const data = await openMeteoResponse.json();
      const responseHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      };
      return new Response(JSON.stringify(data), { headers: responseHeaders });
    }
    throw new Error(`Open-Meteo responded with status: ${openMeteoResponse.status}`);

  } catch (e) {
    console.error('Error fetching from Open-Meteo:', e.message);
    const responseHeaders = { 'Access-Control-Allow-Origin': '*' };
    return new Response(JSON.stringify({ error: 'All geocoding services failed.' }), {
      status: 502, // Bad Gateway, since our server failed to talk to upstream servers
      headers: responseHeaders,
    });
  }
}
