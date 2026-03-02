// Test script to diagnose PDF reading issue via invokeLLM
import dotenv from "dotenv";
dotenv.config();

const API_URL = process.env.BUILT_IN_FORGE_API_URL 
  ? `${process.env.BUILT_IN_FORGE_API_URL.replace(/\/$/, "")}/v1/chat/completions`
  : "https://forge.manus.im/v1/chat/completions";
const API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

// Get a real document URL from the database
import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute("SELECT id, fileName, fileUrl, mimeType, status, ocrText FROM documents ORDER BY id DESC LIMIT 5");
console.log("=== Recent documents ===");
for (const r of rows) {
  console.log(`  id=${r.id} file=${r.fileName} mime=${r.mimeType} status=${r.status} hasOcrText=${!!r.ocrText}`);
}

// Find a PDF document
const pdfDoc = rows.find(r => r.mimeType === "application/pdf" || r.fileName.endsWith(".pdf"));
if (!pdfDoc) {
  console.log("No PDF documents found");
  await conn.end();
  process.exit(0);
}

console.log(`\n=== Testing with PDF: ${pdfDoc.fileName} (id=${pdfDoc.id}) ===`);
console.log(`  URL: ${pdfDoc.fileUrl}`);

// First, check if the URL is accessible
try {
  const urlCheck = await fetch(pdfDoc.fileUrl, { method: "HEAD" });
  console.log(`  URL accessible: ${urlCheck.ok} (status: ${urlCheck.status}, content-type: ${urlCheck.headers.get("content-type")})`);
} catch (e) {
  console.log(`  URL check failed: ${e.message}`);
}

// Test 1: Using file_url (current approach)
console.log("\n=== Test 1: file_url approach ===");
try {
  const res1 = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      max_tokens: 32768,
      thinking: { budget_tokens: 128 },
      messages: [
        { role: "system", content: "Extract all transaction data from this document. Return a JSON object." },
        { role: "user", content: [
          { type: "text", text: `Extract data from: ${pdfDoc.fileName}` },
          { type: "file_url", file_url: { url: pdfDoc.fileUrl, mime_type: "application/pdf" } }
        ]}
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "test_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              extractedText: { type: "string" },
              transactionCount: { type: "number" }
            },
            required: ["extractedText", "transactionCount"],
            additionalProperties: false,
          }
        }
      }
    }),
  });
  
  const data1 = await res1.json();
  console.log(`  Status: ${res1.status}`);
  console.log(`  Finish reason: ${data1.choices?.[0]?.finish_reason}`);
  const content1 = data1.choices?.[0]?.message?.content;
  console.log(`  Content type: ${typeof content1}, isArray: ${Array.isArray(content1)}`);
  if (typeof content1 === "string") {
    console.log(`  Content (first 500): ${content1.slice(0, 500)}`);
  } else if (Array.isArray(content1)) {
    console.log(`  Content parts: ${content1.length}`);
    for (const part of content1) {
      console.log(`    Part type: ${part.type}, text length: ${part.text?.length ?? 'N/A'}`);
      if (part.type === "text") {
        console.log(`    Text (first 500): ${part.text?.slice(0, 500)}`);
      }
    }
  } else {
    console.log(`  Content: ${JSON.stringify(content1)?.slice(0, 500)}`);
  }
  
  if (data1.error) {
    console.log(`  ERROR: ${JSON.stringify(data1.error)}`);
  }
} catch (e) {
  console.log(`  EXCEPTION: ${e.message}`);
}

// Test 2: Without thinking tokens
console.log("\n=== Test 2: file_url WITHOUT thinking ===");
try {
  const res2 = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      max_tokens: 32768,
      messages: [
        { role: "system", content: "Extract all transaction data from this document. Return a JSON object." },
        { role: "user", content: [
          { type: "text", text: `Extract data from: ${pdfDoc.fileName}` },
          { type: "file_url", file_url: { url: pdfDoc.fileUrl, mime_type: "application/pdf" } }
        ]}
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "test_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              extractedText: { type: "string" },
              transactionCount: { type: "number" }
            },
            required: ["extractedText", "transactionCount"],
            additionalProperties: false,
          }
        }
      }
    }),
  });
  
  const data2 = await res2.json();
  console.log(`  Status: ${res2.status}`);
  console.log(`  Finish reason: ${data2.choices?.[0]?.finish_reason}`);
  const content2 = data2.choices?.[0]?.message?.content;
  console.log(`  Content type: ${typeof content2}, isArray: ${Array.isArray(content2)}`);
  if (typeof content2 === "string") {
    console.log(`  Content (first 500): ${content2.slice(0, 500)}`);
  } else if (Array.isArray(content2)) {
    console.log(`  Content parts: ${content2.length}`);
    for (const part of content2) {
      console.log(`    Part type: ${part.type}, text length: ${part.text?.length ?? 'N/A'}`);
      if (part.type === "text") {
        console.log(`    Text (first 500): ${part.text?.slice(0, 500)}`);
      }
    }
  }
  
  if (data2.error) {
    console.log(`  ERROR: ${JSON.stringify(data2.error)}`);
  }
} catch (e) {
  console.log(`  EXCEPTION: ${e.message}`);
}

await conn.end();
console.log("\n=== Done ===");
