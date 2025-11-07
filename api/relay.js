import { Redis } from "@upstash/redis";

const J = (o, s = 200) =>
  new Response(JSON.stringify(o), { 
    status: s, 
    headers: { 
      "content-type": "application/json",
      "access-control-allow-origin": "*"
    } 
  });

export default async function handler(req) {
  console.log("Request method:", req.method);
  
  // Health check
  if (req.method === "GET") {
    return J({ status: "OK", message: "API is working" });
  }

  if (req.method !== "POST") {
    return J({ error: "Method not allowed" }, 405);
  }

  try {
    // Parse JSON
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return J({ error: "Invalid JSON" }, 400);
    }

    console.log("Received body:", body);

    // SIMPLE AUTH
    const authHeader = req.headers.get("authorization") || req.headers.get("x-api-key");
    if (!authHeader || !authHeader.includes("iloveyou123")) {
      return J({ error: "Unauthorized" }, 401);
    }

    // ✅ REDIS RATE LIMITING (Your protector needs this!)
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Simple rate limiting
    const userId = body.user_id || "unknown";
    const minute = Math.floor(Date.now() / 60000);
    const rateLimitKey = `rate:${userId}:${minute}`;
    
    const currentCount = await redis.incr(rateLimitKey);
    if (currentCount === 1) {
      await redis.expire(rateLimitKey, 60);
    }

    if (currentCount > 20) {
      return J({ error: "Rate limit exceeded" }, 429);
    }

    // Get Discord webhook
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      return J({ error: "Discord webhook not configured" }, 500);
    }

    // Send to Discord
    const discordPayload = {
      content: String(body.content || "No content").slice(0, 1900),
      username: "Relay Protector",
      allowed_mentions: { parse: [] }
    };

    const discordResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload),
    });

    if (discordResponse.ok) {
      return J({ 
        success: true, 
        message: "Sent to Discord",
        rateLimit: currentCount
      });
    } else {
      return J({ error: "Discord rejected message" }, 500);
    }

  } catch (error) {
    console.log("❌ Server error:", error.message);
    return J({ error: "Internal server error" }, 500);
  }
}
