import OpenAI from "openai";

export const createOpenAIClient = () => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing VITE_OPENAI_API_KEY. Add it to a .env.local file in the project root."
    );
  }

  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
};
