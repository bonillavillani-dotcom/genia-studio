// GenIA Studio - Cloudflare Worker Proxy
// Permite llamadas a fal.ai desde el navegador sin bloqueo CORS

export default {
  async fetch(request, env) {
    // Allow CORS from anywhere
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname; // e.g. /proxy/fal-ai/flux/schnell

      // ── Route: POST /proxy/* → fal.ai ──────────────────────────────
      if (path.startsWith("/proxy/")) {
        const modelPath = path.replace("/proxy/", "");
        const body = await request.json();
        const falApiKey = request.headers.get("X-Fal-Key");

        if (!falApiKey) {
          return new Response(JSON.stringify({ error: "Missing X-Fal-Key header" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Submit to fal.ai queue
        const submitRes = await fetch(`https://queue.fal.run/${modelPath}`, {
          method: "POST",
          headers: {
            "Authorization": `Key ${falApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!submitRes.ok) {
          const err = await submitRes.text();
          return new Response(err, {
            status: submitRes.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const { request_id } = await submitRes.json();

        // Poll until complete (max 5 min)
        for (let i = 0; i < 100; i++) {
          await new Promise(r => setTimeout(r, 3000));

          const pollRes = await fetch(`https://queue.fal.run/${modelPath}/requests/${request_id}`, {
            headers: { "Authorization": `Key ${falApiKey}` },
          });

          if (!pollRes.ok) continue;
          const result = await pollRes.json();

          if (result.status === "COMPLETED") {
            const out = result.output || result;
            return new Response(JSON.stringify(out), {
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
          if (result.status === "FAILED") {
            return new Response(JSON.stringify({ error: result.error || "Generation failed" }), {
              status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
        }
        return new Response(JSON.stringify({ error: "Timeout" }), {
          status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // ── Route: GET / → health check ────────────────────────────────
      return new Response(JSON.stringify({ status: "GenIA Studio Worker activo ✓" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        }
      });
    }
  }
};
