// Test the invokeLLM function directly to see what it returns
import 'dotenv/config';

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

const fileUrl = "https://d2xsxph8kpxj0f.cloudfront.net/110938298/XKe8fHcJg7hMbkDDQ2kSnY/docs/1/Zl6pfDimCEvESQrXlikOD-CIMBClicks.pdf";

async function testInvokeLLM() {
  console.log("Testing with SAME parameters as invokeLLM (including thinking)...\n");

  const systemPrompt = `You are Sarah, a Senior Bookkeeper. Extract all text and structured data from the uploaded document.
For bank/credit card statements, extract EVERY transaction line and return JSON.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: [
      { type: "text", text: "Please extract and categorize this credit_card_statement document: CIMBClicks.pdf" },
      { type: "file_url", file_url: { url: fileUrl, mime_type: "application/pdf" } }
    ]}
  ];

  const payload = {
    model: "gemini-2.5-flash",
    messages,
    max_tokens: 32768,
    thinking: { budget_tokens: 128 },
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ocr_result",
        strict: true,
        schema: {
          type: "object",
          properties: {
            extractedText: { type: "string" },
            vendor: { type: ["string", "null"] },
            date: { type: ["string", "null"] },
            total: { type: ["number", "null"] },
            currency: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  amount: { type: "number" }
                },
                required: ["description", "amount"],
                additionalProperties: false,
              }
            },
            taxAmount: { type: ["number", "null"] },
            invoiceNumber: { type: ["string", "null"] },
            documentType: { type: "string" },
            suggestedCategory: { type: ["string", "null"] },
            clarificationNeeded: {
              type: "array",
              items: { type: "string" }
            },
            transactions: {
              type: ["array", "null"],
              items: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  description: { type: "string" },
                  amount: { type: "number" },
                  type: { type: "string" },
                  category: { type: "string" },
                  confidence: { type: "number" }
                },
                required: ["date", "description", "amount", "type", "category", "confidence"],
                additionalProperties: false,
              }
            }
          },
          required: ["extractedText", "vendor", "date", "total", "currency", "items", "taxAmount", "invoiceNumber", "documentType", "suggestedCategory", "clarificationNeeded", "transactions"],
          additionalProperties: false,
        }
      }
    }
  };

  try {
    const response = await fetch(`${FORGE_API_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${FORGE_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    console.log("Response status:", response.status);
    const data = await response.json();
    
    console.log("\n=== Full response structure ===");
    console.log("choices[0].message.role:", data.choices?.[0]?.message?.role);
    console.log("choices[0].message.content type:", typeof data.choices?.[0]?.message?.content);
    console.log("choices[0].message.content is array:", Array.isArray(data.choices?.[0]?.message?.content));
    
    const content = data.choices?.[0]?.message?.content;
    console.log("\n=== Content value ===");
    if (typeof content === "string") {
      console.log("Content is string, length:", content.length);
      console.log("First 500 chars:", content.slice(0, 500));
      try {
        const parsed = JSON.parse(content);
        console.log("\nParsed successfully!");
        console.log("Transactions count:", parsed.transactions?.length ?? 0);
        console.log("Extracted text length:", parsed.extractedText?.length ?? 0);
      } catch (e) {
        console.log("Failed to parse as JSON:", e.message);
      }
    } else if (Array.isArray(content)) {
      console.log("Content is ARRAY with", content.length, "parts");
      content.forEach((part, i) => {
        console.log(`Part ${i}:`, JSON.stringify(part).slice(0, 200));
      });
    } else {
      console.log("Content is:", typeof content, JSON.stringify(content)?.slice(0, 500));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

testInvokeLLM();
