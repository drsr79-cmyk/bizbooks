/**
 * Robustly extract string content from LLM response.
 * Handles both plain string content and array content (from thinking models).
 */
export function extractLLMContent(result: any): string | null {
  const rawContent = result?.choices?.[0]?.message?.content;
  
  if (typeof rawContent === "string") {
    return rawContent;
  }
  
  if (Array.isArray(rawContent)) {
    // Thinking model may return content as array of parts
    // Look for text parts first
    const textPart = rawContent.find((p: any) => p.type === "text");
    if (textPart && typeof textPart.text === "string") {
      return textPart.text;
    }
    // Fallback: try any string content in the array
    for (const part of rawContent) {
      if (typeof part === "string") return part;
      if (part?.text && typeof part.text === "string") return part.text;
    }
  }
  
  console.error(`[extractLLMContent] Unexpected content type: ${typeof rawContent}, isArray: ${Array.isArray(rawContent)}, value: ${JSON.stringify(rawContent)?.slice(0, 300)}`);
  return null;
}

/**
 * Parse LLM response as JSON, with robust content extraction and error handling.
 */
export function parseLLMJson(result: any, fallback: any = null): any {
  const content = extractLLMContent(result);
  if (!content) return fallback;
  
  try {
    return JSON.parse(content);
  } catch (err: any) {
    console.error(`[parseLLMJson] JSON parse failed: ${err.message}. Content: ${content.slice(0, 300)}`);
    return fallback;
  }
}
