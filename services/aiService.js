import OpenAI, { toFile } from "openai";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn("⚠️ WARNING: OPENAI_API_KEY is not set in environment variables!");
}

const openai = new OpenAI({
  apiKey: apiKey || "dummy-key-for-now",
});

/**
 * Transcribe audio buffer using OpenAI Whisper-1 model
 * @param {Buffer} fileBuffer
 * @param {string} originalname
 * @returns {Promise<string>} Transcribed text
 */
export const transcribeAudio = async (fileBuffer, originalname) => {
  try {
    const fileObj = await toFile(fileBuffer, originalname);
    const response = await openai.audio.transcriptions.create({
      file: fileObj,
      model: "whisper-1",
    });
    return response.text;
  } catch (error) {
    console.error("❌ Whisper Transcription Error:", error.message);
    throw new Error(`Speech-to-Text translation failed: ${error.message}`);
  }
};

/**
 * Generate friendly language tutor response with GPT-4o
 * @param {string} userText
 * @param {string} targetLanguage
 * @returns {Promise<{aiReply: string, translation: string, grammarScore: number, feedbackText: string}>}
 */
export const generateTutorResponse = async (userText, targetLanguage = "English") => {
  try {
    const systemPrompt = `You are Lnaguage_Learning, a friendly, encouraging, and highly effective language tutor.
The user is learning ${targetLanguage} and just said: "${userText}".
Provide a helpful tutor response.

You must respond with a JSON object strictly matching this schema:
{
  "aiReply": "A warm, natural, conversational response in ${targetLanguage} answering the user, kept brief (max 2-3 sentences).",
  "translation": "The English translation of your aiReply.",
  "grammarScore": 85, // An integer score between 0 and 100 representing the grammatical correctness of what the user said: "${userText}". If the user text is brief or conversational (e.g. "Hello", "How are you?"), give a high score if correct.
  "feedbackText": "Specific grammar correction or suggestions in English. If they made no errors, praise their formulation or suggest an alternative, more advanced vocabulary word."
}

Do not include any markup, markdown tags, or explanatory text outside the JSON object. Output ONLY the JSON block.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error("❌ GPT Tutor Response Error:", error.message);
    throw new Error(`AI Tutor response generation failed: ${error.message}`);
  }
};

/**
 * Generate audio buffer from text using OpenAI TTS-1
 * @param {string} text
 * @returns {Promise<Buffer>} Audio buffer
 */
export const textToSpeech = async (text) => {
  try {
    const mp3Response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy", // friendly tutor voice
      input: text,
    });
    const buffer = Buffer.from(await mp3Response.arrayBuffer());
    return buffer;
  } catch (error) {
    console.error("❌ Text-to-Speech Error:", error.message);
    throw new Error(`Speech synthesis failed: ${error.message}`);
  }
};
