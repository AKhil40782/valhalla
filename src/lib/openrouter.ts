
import { createOpenAI } from "@ai-sdk/openai";

export const openRouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    headers: {
        "HTTP-Referer": "http://localhost:3000", // Required for free models on OpenRouter
        "X-Title": "Fraud Intel System"
    }
});
