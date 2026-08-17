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


export const transcribeAudio = async (fileBuffer, originalname, fileMimeType = null) => {
  if (googleApiKey && googleApiKey !== "dummy-key-for-now") {
    try {
      let mimeType = fileMimeType;

      // If mimeType is not provided, or is generic, resolve from file extension
      if (!mimeType || mimeType === "application/octet-stream" || mimeType === "blob") {
        mimeType = "audio/mpeg"; // standard default
        const ext = originalname.substring(originalname.lastIndexOf(".")).toLowerCase();
        if (ext === ".wav") mimeType = "audio/wav";
        else if (ext === ".m4a") mimeType = "audio/m4a";
        else if (ext === ".ogg") mimeType = "audio/ogg";
        else if (ext === ".aac") mimeType = "audio/aac";
        else if (ext === ".webm") mimeType = "audio/webm";
        else if (ext === ".mp3") mimeType = "audio/mpeg";
      }

      // Normalize common MIME type aliases for Gemini support
      if (mimeType === "audio/mp3") {
        mimeType = "audio/mpeg";
      } else if (mimeType === "audio/x-m4a") {
        mimeType = "audio/m4a";
      } else if (mimeType === "audio/x-wav") {
        mimeType = "audio/wav";
      } else if (mimeType === "audio/x-aac") {
        mimeType = "audio/aac";
      }

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
      if (error.response?.data) {
        console.error("❌ Gemini Transcription Error Details:", JSON.stringify(error.response.data, null, 2));
      }
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


/**
 * Add this function to your existing services/aiService.js
 * (same file that has transcribeAudio, generateTutorResponse, textToSpeech).
 * Uses the same Gemini-first / OpenAI-fallback pattern as generateTutorResponse.
 */

export const generateTaskChatResponse = async ({
  topicTitle,
  topicDescription,
  currentTask, // { title, description }
  conversationHistory, // [{ role: "ai"|"user", text }]
  userText,
  targetLanguage = "English",
}) => {
  const historyText = conversationHistory
    .map((m) => `${m.role === "ai" ? "Tutor" : "Student"}: ${m.text}`)
    .join("\n");

  const systemPrompt = `You are Lnaguage_Learning, a friendly, encouraging language tutor running a topic-based practice session.

Topic: "${topicTitle}" - ${topicDescription}
Current task the student is practicing: "${currentTask.title}" - ${currentTask.description}
Target language: ${targetLanguage}

Conversation so far:
${historyText || "(This is the first message.)"}

The student just said: "${userText}"

Judge whether the student's message reasonably demonstrates/practices the current task ("${currentTask.title}"). Be encouraging and lenient - if they made a genuine attempt relevant to the task, mark it completed.

You must respond with a JSON object strictly matching this schema:
{
  "aiReply": "A warm, natural, conversational tutor reply in ${targetLanguage}, max 2-3 sentences. If the task is now completed, briefly praise them and introduce the NEXT thing to practice. If not yet completed, gently guide them toward it.",
  "translation": "English translation of aiReply.",
  "taskCompleted": true or false,
  "feedbackText": "One short line of encouragement or correction in English."
}

Do not include markdown or any text outside the JSON object. Output ONLY the JSON block.`;

  if (googleApiKey && googleApiKey !== "dummy-key-for-now") {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleApiKey}`;
      const response = await axios.post(url, {
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      });

      const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error("No response content returned from Gemini");
      return JSON.parse(content);
    } catch (error) {
      console.error("❌ Gemini Task Chat Error:", error.message);
      throw new Error(`Google Gemini task chat generation failed: ${error.message}`);
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
    console.error("❌ GPT Task Chat Error:", error.message);
    throw new Error(`AI task chat generation failed: ${error.message}`);
  }
};

export const translateText = async (text, targetLanguage) => {
  if (!text || !text.trim()) return "";

  // 1. Try Free Google Translate API first for robust, keyless translations
  try {
    const langMap = {
      "english": "en",
      "american english": "en",
      "british english": "en",
      "spanish": "es",
      "french": "fr",
      "german": "de",
      "italian": "it",
      "gujarati": "gu",
      "hindi": "hi",
      "japanese": "ja",
      "portuguese": "pt",
      "vietnamese": "vi",
      "chinese": "zh",
      "korean": "ko",
      "russian": "ru"
    };
    const lowerLang = targetLanguage.toLowerCase().trim();
    const langCode = langMap[lowerLang] || (lowerLang.length >= 2 ? lowerLang.substring(0, 2) : "en");
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${langCode}&dt=t&q=${encodeURIComponent(text.trim())}`;
    const res = await axios.get(url);
    const translatedText = res.data?.[0]?.[0]?.[0];
    if (translatedText) return translatedText.trim();
  } catch (err) {
    console.warn("⚠️ Free Google Translate failed, falling back to AI:", err.message);
  }

  // 2. Fallback to AI (Gemini or OpenAI) if API keys are configured
  const systemPrompt = `You are an expert translator. Translate the English text into standard, natural ${targetLanguage}. 
For technical terms, everyday objects, or loanwords (like "laptop", "mouse", "keyboard", "hello", etc.), please provide the standard, native word/phrase used in ${targetLanguage} (e.g. translate "laptop" to "computadora portátil" or "ordenador portátil" in Spanish, "ordinateur portable" in French, "ノートパソコン" in Japanese).
Do NOT return the original English word if a standard native equivalent exists in ${targetLanguage}.
Return ONLY the direct translation. Do not include explanation, markdown, quotes, or notes.

Text to translate: "${text}"`;

  if (googleApiKey && googleApiKey !== "dummy-key-for-now" && !googleApiKey.startsWith("g.a000")) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleApiKey}`;
      const response = await axios.post(url, {
        contents: [{ parts: [{ text: systemPrompt }] }]
      });
      const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) return content.trim();
    } catch (error) {
      console.error("❌ Gemini Translation Error:", error.message);
    }
  }

  if (openaiApiKey && openaiApiKey !== "dummy-key-for-now") {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: systemPrompt }],
        temperature: 0.3,
      });
      const content = response.choices[0].message.content;
      if (content) return content.trim();
    } catch (error) {
      console.error("❌ OpenAI Translation Error:", error.message);
    }
  }

  return text;
};

export const translateArray = async (arr, targetLanguage) => {
  if (!arr || !arr.length) return [];
  try {
    const translated = [];
    for (const item of arr) {
      const trans = await translateText(item, targetLanguage);
      translated.push(trans);
    }
    return translated;
  } catch (err) {
    console.warn("⚠️ Array translation failed:", err.message);
    return arr;
  }
};