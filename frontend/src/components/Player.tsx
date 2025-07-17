import { useEffect, useRef } from "react";

interface PlayerProps {
  stream: MediaStream;
  name: string;
  you?: boolean;
  audioStream?: MediaStream;
  isScreenShare?: boolean;
}

const Player = ({
  stream,
  name,
  you = false,
  audioStream,
  isScreenShare = false,
}: PlayerProps) => {
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
    <div className={`relative ${isScreenShare ? "col-span-2" : ""}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={you} // Only mute local video to prevent echo
        className={`rounded-lg shadow-lg bg-black ${
          isScreenShare
            ? "w-full h-[480px] object-contain"
            : "w-[320px] h-[240px]"
        }`}
      />
      {audioStream && <audio ref={audioRef} autoPlay playsInline />}
      <div
        className={`absolute bottom-2 left-2 px-2 py-1 rounded text-white text-sm ${
          isScreenShare ? "bg-blue-500/70" : "bg-black/50"
        }`}
      >
        {isScreenShare ? "📺 " : ""}
        {name}
      </div>
    </div>
  );
};

export default Player;
