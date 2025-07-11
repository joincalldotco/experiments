import { useState, useEffect } from "react";
import { useSocket } from "../hooks/useSocket";

interface MediaControlsProps {
  localStream: MediaStream;
}

export default function MediaControls({ localStream }: MediaControlsProps) {
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const { socket } = useSocket();

  const toggleAudio = () => {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioEnabled(audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(videoTrack.enabled);
    }
  };

  const startRecording = () => {
    if (!socket) return;
    socket.emit("startRecording", { userId: socket.id }, (response: any) => {
      if (response.error) {
        console.error("Failed to start recording:", response.error);
        return;
      }
      setRecordingId(response.recordingId);
      setIsRecording(true);
    });
  };

  const stopRecording = () => {
    if (!socket || !recordingId) return;
    socket.emit("stopRecording", { recordingId }, (response: any) => {
      if (response.error) {
        console.error("Failed to stop recording:", response.error);
        return;
      }
      setRecordingId(null);
      setIsRecording(false);
    });
  };

  useEffect(() => {
    return () => {
      if (recordingId) {
        stopRecording();
      }
    };
  }, [recordingId]);

  return (
    <div className="flex gap-2 mt-4">
      <button
        className={`px-4 py-2 rounded ${
          isAudioEnabled ? "bg-green-500" : "bg-red-500"
        } text-white`}
        onClick={toggleAudio}
      >
        {isAudioEnabled ? "Mute Audio" : "Unmute Audio"}
      </button>
      <button
        className={`px-4 py-2 rounded ${
          isVideoEnabled ? "bg-green-500" : "bg-red-500"
        } text-white`}
        onClick={toggleVideo}
      >
        {isVideoEnabled ? "Stop Video" : "Start Video"}
      </button>
      <button
        className={`px-4 py-2 rounded ${
          isRecording ? "bg-red-500" : "bg-blue-500"
        } text-white`}
        onClick={isRecording ? stopRecording : startRecording}
      >
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>
    </div>
  );
}
