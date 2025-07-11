import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, User } from "lucide-react";

interface PlayerProps {
  stream: MediaStream;
  name: string;
  you?: boolean;
  audioStream?: MediaStream;
}

const Player = ({ stream, name, you = false, audioStream }: PlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;

      // Check if video track exists and is enabled
      const videoTrack = stream.getVideoTracks()[0];
      setIsCameraOn(!!videoTrack?.enabled);

      // Listen for track enabled/disabled events
      const handleTrackEnabled = () => setIsCameraOn(true);
      const handleTrackDisabled = () => setIsCameraOn(false);

      if (videoTrack) {
        videoTrack.addEventListener("enabled", handleTrackEnabled);
        videoTrack.addEventListener("disabled", handleTrackDisabled);
      }

      return () => {
        if (videoTrack) {
          videoTrack.removeEventListener("enabled", handleTrackEnabled);
          videoTrack.removeEventListener("disabled", handleTrackDisabled);
        }
      };
    }
  }, [stream]);

  console.log({ isCameraOn });

  useEffect(() => {
    if (audioRef.current && audioStream) {
      audioRef.current.srcObject = audioStream;
      audioRef.current.play().catch((error) => {
        console.error("Error playing audio:", error);
      });
    }
  }, [audioStream]);

  return (
    <div className="relative">
      {isCameraOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={you}
          className="rounded-lg shadow-lg w-[320px] h-[240px] bg-black object-cover"
        />
      ) : (
        <div className="rounded-lg shadow-lg w-[320px] h-[240px] bg-red-500 flex items-center justify-center">
          <User className="w-20 h-20 text-slate-400" />
        </div>
      )}
      {audioStream && <audio ref={audioRef} autoPlay playsInline />}
      <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur px-2 py-1 rounded text-white text-sm flex items-center gap-2">
        <User className="w-4 h-4" />
        {name}
      </div>
      <div className="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded text-white text-sm flex items-center gap-2">
        {audioStream ? (
          <Mic className="w-4 h-4" />
        ) : (
          <MicOff className="w-4 h-4" />
        )}
      </div>
    </div>
  );
};

export default Player;
