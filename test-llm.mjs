import 'dotenv/config';

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

const fileUrl = "https://d2xsxph8kpxj0f.cloudfront.net/110938298/XKe8fHcJg7hMbkDDQ2kSnY/docs/1/Zl6pfDimCEvESQrXlikOD-CIMBClicks.pdf";

async function testLLM() {
  console.log("Testing LLM with PDF file_url...");
  console.log("API URL:", FORGE_API_URL);
  console.log("API Key present:", !!FORGE_API_KEY);
  
  const messages = [
    { role: "system", content: "You are a document analysis expert. Extract text from the uploaded document and return a brief summary." },
    { role: "user", content: [
      { type: "text", text: "Please extract text from this credit card statement PDF" },
      { type: "file_url", file_url: { url: fileUrl, mime_type: "application/pdf" } }
    ]}
  ];

  try {
    const response = await fetch(`${FORGE_API_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${FORGE_API_KEY}`,
      },
      body: JSON.stringify({
        messages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "test_result",
            strict: true,
            schema: {
              type: "object",
              properties: {
                extractedText: { type: "string" },
                transactionCount: { type: "number" },
              },
              required: ["extractedText", "transactionCount"],
              additionalProperties: false,
            }
          }
        }
      }),
    });

    console.log("Response status:", response.status);
    const data = await response.json();
    console.log("Response data:", JSON.stringify(data, null, 2));
    
    if (data.choices?.[0]?.message?.content) {
      const parsed = JSON.parse(data.choices[0].message.content);
      console.log("\nParsed result:", JSON.stringify(parsed, null, 2));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

testLLM();
