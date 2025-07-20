import { Camera, CameraOff, Mic, MicOff, User } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "../lib/utils";

interface PlayerProps {
  stream: MediaStream;
  name: string;
  you?: boolean;
  audioStream?: MediaStream;
  isScreenShare?: boolean;
  micActive?: boolean;
  camActive?: boolean;
  isShareScreen?: boolean;
}

const Player = ({
  stream,
  name,
  you = false,
  audioStream,
  isScreenShare = false,
  micActive = false,
  camActive = false,
}: PlayerProps) => {
  console.log({
    you,
    name,
    micActive,
    camActive,
    isScreenShare,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;

      if (isScreenShare) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
              console.log(
                "Screen share resolution changed:",
                entry.contentRect
              );
            }
          });

          resizeObserver.observe(videoRef.current);

          return () => {
            resizeObserver.disconnect();
          };
        }
      }
    }
  }, [stream, isScreenShare]);

  useEffect(() => {
    if (audioRef.current && audioStream) {
      audioRef.current.srcObject = audioStream;
      audioRef.current.play().catch((error) => {
        console.error("Error playing audio:", error);
      });
    }
  }, [audioStream]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg",
        isScreenShare ? "col-span-2" : ""
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={you}
        className={`rounded-lg shadow-lg bg-black ${
          isScreenShare
            ? "w-full h-[480px] object-contain"
            : "w-[320px] h-[240px]"
        }`}
      />
      {audioStream && <audio ref={audioRef} autoPlay playsInline />}
      {you ? null : camActive ? null : (
        <div className="absolute inset-0 z-50 w-full h-full bg-black flex items-center justify-center">
          <div className="size-20 bg-background/10 rounded-full flex items-center justify-center">
            <User className="size-10 text-white" />
          </div>
        </div>
      )}
      <div
        className={cn(
          "absolute bottom-0 left-0 px-2 py-1 text-white text-sm flex items-center justify-between w-full",
          isScreenShare ? "bg-blue-500/70" : "bg-black/50"
        )}
      >
        <span className="flex items-center gap-2">
          {isScreenShare ? "📺 " : ""}
          {name}
        </span>
        <span className="flex items-center gap-2">
          {you ? null : (
            <>
              {micActive ? (
                <Mic className="size-4" />
              ) : (
                <MicOff className="size-4" />
              )}
              {camActive ? (
                <Camera className="size-4" />
              ) : (
                <CameraOff className="size-4" />
              )}
            </>
          )}
        </span>
      </div>
    </div>
  );
};

export default Player;
