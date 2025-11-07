// SIMPLE VERSION - NO REDIS, JUST DISCORD
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
  
  // Health check - SIMPLE
  if (req.method === "GET") {
    console.log("Health check passed");
    return J({ status: "OK", message: "API is working" });
  }

  // Only allow POST
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

    // SIMPLE AUTH - No Redis, just check the key
    const authHeader = req.headers.get("authorization") || req.headers.get("x-api-key");
    if (!authHeader || !authHeader.includes("iloveyou123")) {
      return J({ error: "Unauthorized" }, 401);
    }

    // Get Discord webhook from environment
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      console.log("No Discord webhook URL found");
      return J({ error: "Discord webhook not configured" }, 500);
    }

    // Prepare Discord message
    const content = `Test from API: ${body.content || "No content"}`;
    
    const discordPayload = {
      content: content.slice(0, 1900),
      username: "Relay Protector",
      allowed_mentions: { parse: [] }
    };

    console.log("Sending to Discord:", webhookUrl);

    // Send to Discord
    const discordResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(discordPayload),
    });

    if (discordResponse.ok) {
      console.log("✅ Successfully sent to Discord");
      return J({ 
        success: true, 
        message: "Sent to Discord",
        discordStatus: discordResponse.status
      });
    } else {
      const errorText = await discordResponse.text();
      console.log("❌ Discord error:", discordResponse.status, errorText);
      return J({ 
        error: "Discord rejected message",
        discordStatus: discordResponse.status
      }, 500);
    }

  } catch (error) {
    console.log("❌ Server error:", error.message);
    return J({ 
      error: "Internal server error",
      details: error.message 
    }, 500);
  }
}
