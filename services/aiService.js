import OpenAI, { toFile } from "openai";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const openaiApiKey = process.env.OPENAI_API_KEY;
const googleApiKey = process.env.GEMINI_API_KEY;

const openai = new OpenAI({
  apiKey: openaiApiKey || "dummy-key-for-now",
});

export const transcribeAudio = async (fileBuffer, originalname, fileMimeType = null) => {
  if (googleApiKey && googleApiKey !== "dummy-key-for-now") {
    try {
      let mimeType = fileMimeType;

      if (!mimeType || mimeType === "application/octet-stream" || mimeType === "blob") {
        mimeType = "audio/mpeg";
        const ext = originalname.substring(originalname.lastIndexOf(".")).toLowerCase();
        if (ext === ".wav") mimeType = "audio/wav";
        else if (ext === ".m4a") mimeType = "audio/m4a";
        else if (ext === ".ogg") mimeType = "audio/ogg";
        else if (ext === ".aac") mimeType = "audio/aac";
        else if (ext === ".webm") mimeType = "audio/webm";
        else if (ext === ".mp3") mimeType = "audio/mpeg";
      }

      if (mimeType === "audio/mp3") {
        mimeType = "audio/mpeg";
      } else if (mimeType === "audio/x-m4a") {
        mimeType = "audio/m4a";
      } else if (mimeType === "audio/x-wav") {
        mimeType = "audio/wav";
      } else if (mimeType === "audio/x-aac") {
        mimeType = "audio/aac";
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${googleApiKey}`;
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
      console.warn("Gemini Transcription failed, falling back to Whisper:", error.message);
      if (!openaiApiKey || openaiApiKey === "dummy-key-for-now") {
        throw new Error(`Gemini transcription failed (${error.message}) and no valid OPENAI_API_KEY is configured in your .env file.`);
      }
      if (error.response?.data) {
        console.warn("Gemini Transcription Error Details:", JSON.stringify(error.response.data, null, 2));
      }
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
    console.error("Whisper Transcription Error:", error.message);
    throw new Error(`Speech-to-Text translation failed: ${error.message}`);
  }
};

export const generateTutorResponse = async (userText, targetLanguage = "English", nativeLanguage = "Spanish", conversationHistory = [], audioBuffer = null, audioMimeType = null) => {
  let schemaPrompt = `{
  "aiReply": "A warm, natural, conversational response in ${targetLanguage} answering the user, kept brief (max 2-3 sentences).",
  "translation": "The direct translation of your aiReply in ${nativeLanguage}.",
  "grammarScore": 85,
  "feedbackText": "Specific grammar correction or suggestions in ${nativeLanguage}. If they made no errors, praise their formulation or suggest an alternative, more advanced vocabulary word in ${targetLanguage}."`;

  if (audioBuffer) {
    schemaPrompt += `,
  "pronunciationScore": 80,
  "pronunciationFeedback": "Specific feedback in ${nativeLanguage} about their pronunciation, highlighting clear words or words they need to practice."`;
  }

  schemaPrompt += `\n}`;

  const historyText = conversationHistory
    .map((m) => `${m.sender === "tutor" || m.role === "ai" ? "Tutor" : "Student"}: ${m.text}`)
    .join("\n");

  const systemPrompt = `You are Language_Learning, a friendly, encouraging, and highly effective language tutor.
The user is learning ${targetLanguage} and their native language is ${nativeLanguage}.

Conversation history so far:
${historyText || "(This is the start of the conversation.)"}

The student just said: "${userText}".
Provide a helpful tutor response.

You must respond with a JSON object strictly matching this schema:
${schemaPrompt}

Do not include any markup, markdown tags, or explanatory text outside the JSON object. Output ONLY the JSON block.`;

  if (googleApiKey && googleApiKey !== "dummy-key-for-now") {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${googleApiKey}`;

      const parts = [];
      if (audioBuffer && audioMimeType) {
        parts.push({
          inlineData: {
            mimeType: audioMimeType,
            data: audioBuffer.toString("base64")
          }
        });
      }
      parts.push({ text: systemPrompt });

      const response = await axios.post(url, {
        contents: [{ parts }],
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
      console.warn("Gemini Tutor Response failed, falling back to OpenAI:", error.message);
      if (!openaiApiKey || openaiApiKey === "dummy-key-for-now") {
        throw new Error(`Gemini tutor response failed (${error.message}) and no valid OPENAI_API_KEY is configured in your .env file.`);
      }
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
    const parsed = JSON.parse(content);
    if (audioBuffer && parsed.pronunciationScore === undefined) {
      parsed.pronunciationScore = 90;
      parsed.pronunciationFeedback = "Good pronunciation!";
    }
    return parsed;
  } catch (error) {
    console.error("GPT Tutor Response Error:", error.message);
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
      console.error("Google Translate TTS Error:", error.message);
      throw new Error(`Google Translate speech synthesis failed: ${error.message}`);
    }
  }

  try {
    const mp3Response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
    });
    const buffer = Buffer.from(await mp3Response.arrayBuffer());
    return buffer;
  } catch (error) {
    console.error("Text-to-Speech Error:", error.message);
    throw new Error(`Speech synthesis failed: ${error.message}`);
  }
};

export const generateTaskChatResponse = async ({
  topicTitle,
  topicDescription,
  currentTask,
  conversationHistory,
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${googleApiKey}`;
      const response = await axios.post(url, {
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      });

      const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error("No response content returned from Gemini");
      return JSON.parse(content);
    } catch (error) {
      console.warn("Gemini Task Chat failed, falling back to OpenAI:", error.message);
      if (!openaiApiKey || openaiApiKey === "dummy-key-for-now") {
        throw new Error(`Gemini task chat failed (${error.message}) and no valid OPENAI_API_KEY is configured in your .env file.`);
      }
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
    console.error("GPT Task Chat Error:", error.message);
    throw new Error(`AI task chat generation failed: ${error.message}`);
  }
};

export const translateText = async (text, targetLanguage) => {
  if (!text || !text.trim()) return "";

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
  }

  const systemPrompt = `You are an expert translator. Translate the English text into standard, natural ${targetLanguage}. 
For technical terms, everyday objects, or loanwords (like "laptop", "mouse", "keyboard", "hello", etc.), please provide the standard, native word/phrase used in ${targetLanguage} (e.g. translate "laptop" to "computadora portátil" or "ordenador portátil" in Spanish, "ordinateur portable" in French, "ノートパソコン" in Japanese).
Do NOT return the original English word if a standard native equivalent exists in ${targetLanguage}.
Return ONLY the direct translation. Do not include explanation, markdown, quotes, or notes.

Text to translate: "${text}"`;

  if (googleApiKey && googleApiKey !== "dummy-key-for-now" && !googleApiKey.startsWith("g.a000")) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${googleApiKey}`;
      const response = await axios.post(url, {
        contents: [{ parts: [{ text: systemPrompt }] }]
      });
      const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) return content.trim();
    } catch (error) {
      console.error("Gemini Translation Error:", error.message);
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
      console.error("OpenAI Translation Error:", error.message);
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
    console.warn("Array translation failed:", err.message);
    return arr;
  }
};

export const generateConversationHint = async ({
  conversationHistory,
  targetLanguage = "English",
  nativeLanguage = "Spanish",
  learningLevel = "Beginner",
}) => {
  const historyText = conversationHistory
    .map((m) => `${m.sender === "tutor" || m.role === "ai" ? "Tutor" : "Student"}: ${m.text}`)
    .join("\n");

  const systemPrompt = `You are a helpful language tutoring assistant. 
The student is practicing conversation in ${targetLanguage}.
Their native language is ${nativeLanguage}.
Their current proficiency level is ${learningLevel}.

Conversation history:
${historyText || "(No messages yet. The tutor is about to greet the student.)"}

Based on the conversation context, generate ONE helpful hint or sample sentence that the student can say to respond to the tutor's last message.
The hint must match their level (${learningLevel}). For beginners, keep it very simple. For advanced, make it more sophisticated.

You must respond with a JSON object strictly matching this schema:
{
  "hintText": "A suitable reply in ${targetLanguage} for the student.",
  "hintTranslation": "The direct translation of hintText in ${nativeLanguage}."
}

Do not include markdown or any text outside the JSON object. Output ONLY the JSON block.`;

  if (googleApiKey && googleApiKey !== "dummy-key-for-now") {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${googleApiKey}`;
      const response = await axios.post(url, {
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      });

      const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error("No response content returned from Gemini");
      return JSON.parse(content);
    } catch (error) {
      console.warn("Gemini Hint generation failed, falling back to OpenAI:", error.message);
      if (!openaiApiKey || openaiApiKey === "dummy-key-for-now") {
        throw new Error(`Gemini hint generation failed (${error.message}) and no valid OPENAI_API_KEY is configured in your .env file.`);
      }
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error("GPT Hint generation failed:", error.message);
    throw new Error(`AI hint generation failed: ${error.message}`);
  }
};