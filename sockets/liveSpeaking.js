import jwt from "jsonwebtoken";
import UserModel from "../model/user.model.js";
import { transcribeAudio, generateTutorResponse, textToSpeech } from "../services/aiService.js";

export default function registerLiveSpeakingSocket(io) {
  // Authentication middleware for Socket.io connections
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("Authentication error: Token is required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await UserModel.findById(decoded.id || decoded._id);

      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      socket.user = user;
      next();
    } catch (err) {
      console.error("❌ Socket auth failed:", err.message);
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`📡 User connected to live speaking mode: ${socket.user.name} (${socket.id})`);

    // Buffer for audio chunks
    socket.audioChunks = [];
    socket.targetLanguage = "English";

    // 1. Client starts a speaking stream
    socket.on("start-speaking", (data) => {
      socket.audioChunks = [];
      if (data?.targetLanguage) {
        socket.targetLanguage = data.targetLanguage;
      }
      console.log(`🎙️ Started recording stream for ${socket.user.name}. Language: ${socket.targetLanguage}`);
      socket.emit("speaking-ready", { status: "ready" });
    });

    // 2. Client sends continuous audio chunks
    socket.on("audio-chunk", (chunk) => {
      if (Buffer.isBuffer(chunk)) {
        socket.audioChunks.push(chunk);
      } else if (chunk && typeof chunk === "object" && chunk.buffer) {
        // Handle array buffer format
        socket.audioChunks.push(Buffer.from(chunk.buffer || chunk));
      } else {
        console.warn("⚠️ Received invalid audio chunk format on socket.");
      }
    });

    // 3. Client finishes speaking, request tutor processing
    socket.on("end-speaking", async () => {
      try {
        if (socket.audioChunks.length === 0) {
          return socket.emit("speaking-error", { message: "No audio chunks received." });
        }

        console.log(`⏱️ Merging ${socket.audioChunks.length} audio chunks for ${socket.user.name}...`);
        const audioBuffer = Buffer.concat(socket.audioChunks);
        socket.audioChunks = []; // clear buffer immediately

        socket.emit("processing-response", { status: "transcribing" });

        // A. Transcribe User Speech
        const transcribedText = await transcribeAudio(audioBuffer, "user_speech.wav");
        console.log(`🗣️ Transcribed [${socket.user.name}]: "${transcribedText}"`);
        socket.emit("user-transcription", { text: transcribedText });

        // B. Generate GPT Response
        socket.emit("processing-response", { status: "thinking" });
        const tutorReply = await generateTutorResponse(transcribedText, socket.targetLanguage);
        console.log(`🤖 Tutor response for [${socket.user.name}]: "${tutorReply.aiReply}"`);

        // C. Generate Speech for Response
        socket.emit("processing-response", { status: "speaking" });
        const speechAudioBuffer = await textToSpeech(tutorReply.aiReply);

        // D. Stream response back
        socket.emit("ai-speaking", {
          text: tutorReply.aiReply,
          translation: tutorReply.translation,
          grammarScore: tutorReply.grammarScore,
          feedbackText: tutorReply.feedbackText,
          audio: speechAudioBuffer, // sends binary audio buffer directly to client
        });

      } catch (error) {
        console.error("❌ Live speaking processing error:", error.message);
        socket.emit("speaking-error", {
          message: "Could not process speaking audio",
          error: error.message,
        });
      }
    });

    // Handle Client Cancellation/Interruption
    socket.on("cancel-speaking", () => {
      console.log(`🚫 Audio session cancelled by client for ${socket.user.name}`);
      socket.audioChunks = [];
    });

    // Disconnect cleanup
    socket.on("disconnect", (reason) => {
      console.log(`🔌 User disconnected from live speaking: ${socket.id}. Reason: ${reason}`);
      socket.audioChunks = [];
    });
  });
}
