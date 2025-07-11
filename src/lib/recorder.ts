import { spawn } from "child_process";
import { Consumer, Transport } from "mediasoup/node/lib/types";
import { Room } from "./room";
import path from "path";
import fs from "fs";

interface RecordingInfo {
  roomId: string;
  userId: string;
  startTime: number;
  ffmpegProcess?: ReturnType<typeof spawn>;
  consumer?: Consumer;
  transport?: Transport;
  filePath: string;
}

export class RoomRecorder {
  private recordings = new Map<string, RecordingInfo>();
  private readonly recordingsDir = path.join(process.cwd(), "recordings");

  constructor() {
    // Ensure recordings directory exists
    if (!fs.existsSync(this.recordingsDir)) {
      fs.mkdirSync(this.recordingsDir, { recursive: true });
    }
  }

  async startRecording(room: Room, userId: string) {
    const recordingId = `${room.id}-${userId}-${Date.now()}`;
    const filePath = path.join(this.recordingsDir, `${recordingId}.webm`);

    // Find the producer for this user
    const peer = Array.from(room.peers.values()).find((p) => p.id === userId);
    if (!peer || peer.producers.length === 0) {
      throw new Error("No media producers found for user");
    }

    // Create a special consumer for recording
    const videoProducer = peer.producers.find((p) => p.kind === "video");
    if (!videoProducer) {
      throw new Error("No video producer found");
    }

    // Create a transport for the recorder
    const transport = await room.createRecvTransport();

    // Connect the transport
    await transport.connect({});

    // Create consumer
    const consumer = await transport.consume({
      producerId: videoProducer.id,
      rtpCapabilities: room.router.rtpCapabilities,
      paused: false,
    });

    // Start ffmpeg process to record the stream
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      "pipe:0", // Input from stdin
      "-c:v",
      "copy", // Copy video codec
      "-c:a",
      "copy", // Copy audio codec
      "-f",
      "webm", // WebM output format
      filePath, // Output file
    ]);

    // Handle ffmpeg process events
    ffmpeg.stderr.on("data", (data) => {
      console.log(`[FFmpeg] ${data.toString()}`);
    });

    ffmpeg.on("close", (code) => {
      console.log(`FFmpeg process exited with code ${code}`);
    });

    // Store recording information
    this.recordings.set(recordingId, {
      roomId: room.id,
      userId,
      startTime: Date.now(),
      ffmpegProcess: ffmpeg,
      consumer,
      transport,
      filePath,
    });

    // Pipe RTP stream to ffmpeg
    consumer.observer.on("close", () => {
      this.stopRecording(recordingId);
    });

    return recordingId;
  }

  async stopRecording(recordingId: string) {
    const recording = this.recordings.get(recordingId);
    if (!recording) return;

    // Close consumer and transport
    if (recording.consumer) {
      await recording.consumer.close();
    }
    if (recording.transport) {
      await recording.transport.close();
    }

    // Stop ffmpeg process
    if (recording.ffmpegProcess?.stdin) {
      recording.ffmpegProcess.stdin.end();
      recording.ffmpegProcess.kill("SIGINT");
    }

    this.recordings.delete(recordingId);

    return {
      filePath: recording.filePath,
      duration: Date.now() - recording.startTime,
    };
  }

  async getRecordingStatus(recordingId: string) {
    const recording = this.recordings.get(recordingId);
    if (!recording) return null;

    return {
      roomId: recording.roomId,
      userId: recording.userId,
      duration: Date.now() - recording.startTime,
      filePath: recording.filePath,
    };
  }

  async getAllRecordings() {
    return Array.from(this.recordings.entries()).map(([id, info]) => ({
      id,
      roomId: info.roomId,
      userId: info.userId,
      duration: Date.now() - info.startTime,
      filePath: info.filePath,
    }));
  }
}
