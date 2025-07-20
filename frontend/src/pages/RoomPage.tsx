import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useMediasoupClient } from "../hooks/useMediasoupClient";
import MediaControls from "../components/MediaControls";
import Player from "../components/Player";
import type { Device } from "mediasoup-client";
import { Button } from "../components/ui/button";

const RoomPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    joinRoom,
    loadDevice,
    createSendTransport,
    createRecvTransport,
    produce,
    localStream,
    setLocalStream, // Make sure this exists in the hook
    connected,
    socket,
    consume,
    deviceRef,
  } = useMediasoupClient();

  const [roomId, setRoomId] = useState(searchParams.get("room") || "");
  const [joined, setJoined] = useState(false);
  const consumedProducersRef = useRef<Set<string>>(new Set());
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});

  const localStreamRef = useRef<MediaStream | null>(null);

  const consumeAndAddTrack = useCallback(
    async ({
      producerId,
      userId,
      kind,
      device,
    }: {
      producerId: string;
      userId: string;
      kind: "audio" | "video";
      device: Device;
    }) => {
      if (consumedProducersRef.current.has(producerId)) return;

      await consume(
        producerId,
        device.rtpCapabilities,
        (stream: MediaStream) => {
          consumedProducersRef.current.add(producerId);

          setRemoteStreams((prevStreams) => {
            const newStreams = { ...prevStreams };

            if (!newStreams[userId]) {
              const combinedStream = new MediaStream();
              stream
                .getTracks()
                .forEach((track) => combinedStream.addTrack(track));
              newStreams[userId] = combinedStream;
            } else {
              const existingStream = newStreams[userId];
              stream.getTracks().forEach((track) => {
                const trackExists = existingStream
                  .getTracks()
                  .some((existingTrack) => existingTrack.id === track.id);
                if (!trackExists) {
                  existingStream.addTrack(track);
                }
              });
            }

            return newStreams;
          });
        }
      );
    },
    [consume]
  );

  const handleUserLeft = ({ userId }: { userId: string }) => {
    setRemoteStreams((prevStreams) => {
      const newStreams = { ...prevStreams };
      if (newStreams[userId]) {
        newStreams[userId].getTracks().forEach((track) => track.stop());
        delete newStreams[userId];
      }
      return newStreams;
    });
  };

  useEffect(() => {
    if (!socket || !joined) return;

    const currentDevice = deviceRef.current;
    if (!currentDevice) return;

    const handleNewProducer = async ({ producerId, userId, kind }: any) => {
      await consumeAndAddTrack({
        producerId,
        userId,
        kind,
        device: currentDevice,
      });
    };

    socket.on("newProducer", handleNewProducer);
    socket.on("userLeft", handleUserLeft);

    return () => {
      socket.off("newProducer", handleNewProducer);
      socket.off("userLeft", handleUserLeft);
    };
  }, [socket, joined, consumeAndAddTrack, deviceRef]);

  const handleJoin = async () => {
    if (!roomId || !socket) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      localStreamRef.current = stream;
      setLocalStream?.(stream); // Ensure hook exposes this

      const { producers: existingProducers } = await joinRoom(roomId);
      setSearchParams({ room: roomId });

      const rtpCapabilities = await new Promise((resolve) => {
        socket.emit("getRouterRtpCapabilities", {}, resolve);
      });

      const mediasoupDevice = await loadDevice(rtpCapabilities as any);
      await createSendTransport();
      await createRecvTransport();
      await produce(stream);

      setJoined(true);

      for (const { producerId, userId, kind } of existingProducers) {
        await consumeAndAddTrack({
          producerId,
          userId,
          kind,
          device: mediasoupDevice,
        });
      }
    } catch (error) {
      console.error("Error joining room:", error);
      setJoined(false);
      setSearchParams({});
    }
  };

  const handleLeaveRoom = () => {
    if (!socket) return;

    socket.emit("leaveRoom");
    setJoined(false);
    setSearchParams({});
    window.location.reload();
    navigate("/");
  };

  return (
    <div className="flex flex-col items-center gap-4 mt-8">
      {!joined ? (
        <div className="flex flex-col gap-2">
          <input
            className="border p-2 rounded"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <Button onClick={handleJoin} disabled={!connected || !roomId}>
            Join Room
          </Button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={handleLeaveRoom}>
              Leave Room
            </Button>
            <Button
              variant="outline"
              onClick={() => console.log({ remoteStreams, socket })}
            >
              Debug
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {localStream && <Player stream={localStream} name="You" you />}
            {Object.entries(remoteStreams).map(([userId, stream]) => (
              <Player
                key={userId}
                stream={stream}
                name={`User ${userId}`}
                you={false}
              />
            ))}
          </div>
        </>
      )}
      {joined && localStream && (
        <MediaControls
          localStream={localStream}
          produce={produce}
          joined={joined}
        />
      )}
    </div>
  );
};

export default RoomPage;
