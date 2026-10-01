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

  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
  let lastStatus = 500;
  let lastBody = "";

  for (const model of models) {
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
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );

    if (r.ok) {
      const data = await r.json();
      const text = (data.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || "")
        .join("");
      return new Response(
        JSON.stringify({ content: [{ type: "text", text }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    lastStatus = r.status;
    lastBody = await r.text();
  }

  return new Response(lastBody || "error", {
    status: lastStatus,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = { path: "/api/kabir" };
