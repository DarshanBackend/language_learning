import jwt from "jsonwebtoken";
import UserModel from "../model/user.model.js";
import { transcribeAudio, generateTutorResponse, textToSpeech } from "../services/aiService.js";

export default function registerLiveSpeakingSocket(io) {
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
      console.error("Socket auth failed:", err.message);
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User connected to live speaking mode: ${socket.user.name} (${socket.id})`);

    socket.audioChunks = [];
    socket.targetLanguage = "English";

    socket.on("start-speaking", (data) => {
      socket.audioChunks = [];
      if (data?.targetLanguage) {
        socket.targetLanguage = data.targetLanguage;
      }
      console.log(`Started recording stream for ${socket.user.name}. Language: ${socket.targetLanguage}`);
      socket.emit("speaking-ready", { status: "ready" });
    });

    socket.on("audio-chunk", (chunk) => {
      if (Buffer.isBuffer(chunk)) {
        socket.audioChunks.push(chunk);
      } else if (chunk && typeof chunk === "object" && chunk.buffer) {
        socket.audioChunks.push(Buffer.from(chunk.buffer || chunk));
      } else {
        console.warn("Received invalid audio chunk format on socket.");
      }
    });

    socket.on("end-speaking", async () => {
      try {
        if (socket.audioChunks.length === 0) {
          return socket.emit("speaking-error", { message: "No audio chunks received." });
        }

        console.log(`Merging ${socket.audioChunks.length} audio chunks for ${socket.user.name}...`);
        const audioBuffer = Buffer.concat(socket.audioChunks);
        socket.audioChunks = [];

        socket.emit("processing-response", { status: "transcribing" });

        const transcribedText = await transcribeAudio(audioBuffer, "user_speech.wav");
        console.log(`Transcribed [${socket.user.name}]: "${transcribedText}"`);
        socket.emit("user-transcription", { text: transcribedText });

        socket.emit("processing-response", { status: "thinking" });
        const tutorReply = await generateTutorResponse(transcribedText, socket.targetLanguage);
        console.log(`Tutor response for [${socket.user.name}]: "${tutorReply.aiReply}"`);

        socket.emit("processing-response", { status: "speaking" });
        const speechAudioBuffer = await textToSpeech(tutorReply.aiReply);

        socket.emit("ai-speaking", {
          text: tutorReply.aiReply,
          translation: tutorReply.translation,
          grammarScore: tutorReply.grammarScore,
          feedbackText: tutorReply.feedbackText,
          audio: speechAudioBuffer,
        });

      } catch (error) {
        console.error("Live speaking processing error:", error.message);
        socket.emit("speaking-error", {
          message: "Could not process speaking audio",
          error: error.message,
        });
      }
    });

    socket.on("cancel-speaking", () => {
      console.log(`Audio session cancelled by client for ${socket.user.name}`);
      socket.audioChunks = [];
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected from live speaking mode: ${socket.user.name}`);
    });
  });
}
