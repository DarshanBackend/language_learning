import OpenAI, { toFile } from "openai";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const openaiApiKey = process.env.OPENAI_API_KEY;
const googleApiKey = process.env.BARD_API || process.env.GEMINI_API_KEY;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: openaiApiKey || "dummy-key-for-now",
});


export const transcribeAudio = async (fileBuffer, originalname) => {
  if (googleApiKey && googleApiKey !== "dummy-key-for-now") {
    try {
      let mimeType = "audio/mp3";
      const ext = originalname.substring(originalname.lastIndexOf(".")).toLowerCase();
      if (ext === ".wav") mimeType = "audio/wav";
      else if (ext === ".m4a") mimeType = "audio/m4a";
      else if (ext === ".ogg") mimeType = "audio/ogg";
      else if (ext === ".aac") mimeType = "audio/aac";
      else if (ext === ".webm") mimeType = "audio/webm";

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleApiKey}`;
      const response = await axios.post(url, {
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType,
                data: fileBuffer.toString("base64")
              }
            },
            {
              text: "Please transcribe this audio recording. Output ONLY the transcribed words, with no punctuation or extra explanation."
            }
          ]
        }]
      });

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("No transcription text returned from Gemini");
      }
      return text.trim();
    } catch (error) {
      console.error("❌ Gemini Transcription Error:", error.message);
      throw new Error(`Google Speech-to-Text transcription failed: ${error.message}`);
    }
  }

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


export const generateTutorResponse = async (userText, targetLanguage = "English") => {
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

  if (googleApiKey && googleApiKey !== "dummy-key-for-now") {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleApiKey}`;
      const response = await axios.post(url, {
        contents: [{
          parts: [{ text: systemPrompt }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

      const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new Error("No response content returned from Gemini");
      }
      return JSON.parse(content);
    } catch (error) {
      console.error("❌ Gemini Tutor Response Error:", error.message);
      throw new Error(`Google Gemini tutor response generation failed: ${error.message}`);
    }
  }

  try {
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

export const textToSpeech = async (text) => {
  if (!openaiApiKey || openaiApiKey === "dummy-key-for-now") {
    try {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(text)}`;
      const response = await axios.get(url, { responseType: "arraybuffer" });
      return Buffer.from(response.data);
    } catch (error) {
      console.error("❌ Google Translate TTS Error:", error.message);
      throw new Error(`Google Translate speech synthesis failed: ${error.message}`);
    }
  }

  // Otherwise, use OpenAI TTS
  try {
    const mp3Response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
    });
    const buffer = Buffer.from(await mp3Response.arrayBuffer());
    return buffer;
  } catch (error) {
    console.error("❌ Text-to-Speech Error:", error.message);
    throw new Error(`Speech synthesis failed: ${error.message}`);
  }
};