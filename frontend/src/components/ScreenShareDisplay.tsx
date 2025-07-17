import { useEffect, useRef, useState } from "react";

interface ScreenShareDisplayProps {
  streams: Record<string, MediaStream>;
  onSelect?: (userId: string) => void;
}

const ScreenShareDisplay = ({ streams, onSelect }: ScreenShareDisplayProps) => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamEntries = Object.entries(streams);

  useEffect(() => {
    if (streamEntries.length > 0 && !selectedUserId) {
      setSelectedUserId(streamEntries[0][0]);
    } else if (streamEntries.length === 0) {
      setSelectedUserId(null);
    } else if (selectedUserId && !streams[selectedUserId]) {
      setSelectedUserId(streamEntries[0][0]);
    }
  }, [streams, selectedUserId]);

  useEffect(() => {
    if (videoRef.current && selectedUserId && streams[selectedUserId]) {
      const stream = streams[selectedUserId];
      videoRef.current.srcObject = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            console.log("Screen share video size changed:", entry.contentRect);
          }
        });

        resizeObserver.observe(videoRef.current);

        return () => {
          resizeObserver.disconnect();
        };
      }
    }
  }, [selectedUserId, streams]);

  const handleSelectStream = (userId: string) => {
    setSelectedUserId(userId);
    if (onSelect) {
      onSelect(userId);
    }
  };

  if (streamEntries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col w-full">
      <div className="relative w-full bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-[480px] object-contain"
        />
        {selectedUserId && (
          <div className="absolute bottom-4 left-4 bg-blue-500/70 px-3 py-1.5 rounded-md text-white">
            📺 {selectedUserId}'s Screen
          </div>
        )}
      </div>

      {streamEntries.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto p-2">
          {streamEntries.map(([userId, stream]) => {
            const thumbVideoRef = useRef<HTMLVideoElement>(null);
            useEffect(() => {
              if (thumbVideoRef.current) {
                thumbVideoRef.current.srcObject = stream;
              }
            }, [stream]);
            return (
              <div
                key={userId}
                className={`relative cursor-pointer transition-all ${
                  selectedUserId === userId
                    ? "border-2 border-blue-500 scale-105"
                    : "border border-gray-300 opacity-80 hover:opacity-100"
                }`}
                onClick={() => handleSelectStream(userId)}
              >
                <video
                  ref={thumbVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-[160px] h-[90px] object-cover rounded"
                />
                <div className="absolute bottom-1 left-1 right-1 text-xs bg-black/60 text-white px-1 py-0.5 truncate rounded">
                  {userId}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ScreenShareDisplay;
