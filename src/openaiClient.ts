import OpenAI from "openai";

/**
 * Create an OpenAI client using a runtime key if provided, otherwise fall back
 * to VITE_OPENAI_API_KEY from the environment. The key is not persisted.
 */
export const createOpenAIClient = (apiKey?: string) => {
  const key =
    apiKey || (import.meta.env.VITE_OPENAI_API_KEY as string | undefined);

  if (!key) {
    throw new Error(
      "Missing OpenAI API key. Provide a runtime key or set VITE_OPENAI_API_KEY."
    );
  }

  return new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true });
};
