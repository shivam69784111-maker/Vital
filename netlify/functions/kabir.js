export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { system, messages } = await req.json();

  const contents = (messages || []).slice(-16).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content || "") }],
  }));
  while (contents.length && contents[0].role !== "user") contents.shift();

  const reply = (text) =>
    new Response(JSON.stringify({ content: [{ type: "text", text }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  const models = [
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
  ];
  const errors = [];

  for (const model of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system || "" }] },
            contents,
            generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
          }),
        }
      );
      const raw = await r.text();
      if (r.ok) {
        const data = JSON.parse(raw);
        const cand = data.candidates && data.candidates[0];
        const text = ((cand && cand.content && cand.content.parts) || [])
          .map((p) => p.text || "")
          .join("");
        if (text) return reply(text);
        errors.push(model + ": empty reply " + ((cand && cand.finishReason) || ""));
      } else {
        errors.push(model + ": " + r.status + " " + raw.slice(0, 200));
      }
    } catch (e) {
      errors.push(model + ": " + e.message);
    }
  }

  return reply("Kabir error -> " + errors.join(" | "));
};

export const config = { path: "/api/kabir" };
