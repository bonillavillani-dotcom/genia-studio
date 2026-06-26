export default {
  async fetch(req) {
    const h = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type,X-Fal-Key","Access-Control-Allow-Methods":"POST,GET,OPTIONS","Content-Type":"application/json"};
    if(req.method==="OPTIONS") return new Response(null,{headers:h});
    try {
      const path = new URL(req.url).pathname;
      if(path.startsWith("/proxy/")) {
        const model = path.slice(7);
        const key = req.headers.get("X-Fal-Key");
        const body = await req.json();
        const r = await fetch("https://fal.run/"+model,{method:"POST",headers:{"Authorization":"Key "+key,"Content-Type":"application/json"},body:JSON.stringify(body)});
        const d = await r.json();
        return new Response(JSON.stringify(d),{status:r.status,headers:h});
      }
      return new Response(JSON.stringify({status:"ok"}),{headers:h});
    } catch(e) {
      return new Response(JSON.stringify({error:e.message}),{status:500,headers:h});
    }
  }
};
