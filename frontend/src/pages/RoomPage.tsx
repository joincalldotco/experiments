import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useMediasoupClient } from "../hooks/useMediasoupClient";
import { useScreenShare } from "../hooks/useScreenShare";
import MediaControls from "../components/MediaControls";
import Player from "../components/Player";
import ScreenShareDisplay from "../components/ScreenShareDisplay";
import type { Device } from "mediasoup-client";
import type { AppData, Transport } from "mediasoup-client/types";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { useUsers } from "../providers/users";

const RoomPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { users } = useUsers();

  const {
    joinRoom,
    loadDevice,
    createSendTransport,
    createRecvTransport,
    produce,
    localStream,
    setLocalStream,
    connected,
    socket,
    consume,
    deviceRef,
  } = useMediasoupClient();

  const { onNewScreenShare, onScreenShareStopped } = useScreenShare();

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
          const newTrack = stream.getTracks()[0];

          setRemoteStreams((prevStreams) => {
            const newStreams = { ...prevStreams };
            let existingStream = newStreams[userId];

            if (existingStream) {
              existingStream.addTrack(newTrack);
            } else {
              existingStream = new MediaStream([newTrack]);
              newStreams[userId] = existingStream;
            }

            return newStreams;
          });
        }
      );
    },
    [consume]
  );

  const handleUserLeft = ({ userId }: { userId: string }) => {
    console.log("User left:", userId);
    setRemoteStreams((prevStreams) => {
      const newStreams = { ...prevStreams };
      if (newStreams[userId]) {
        newStreams[userId].getTracks().forEach((track) => track.stop());
        delete newStreams[userId];
      }
      return newStreams;
    });
    toast.info(`User ${userId} has left the room.`);
  };

  const [sendTransport, setSendTransport] = useState<Transport | null>(null);

  const [screenShares, setScreenShares] = useState<Record<string, MediaStream>>(
    {}
  );

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

    const handleNewScreenShare = async ({
      producerId,
      userId,
      appData,
    }: any) => {
      console.log("New screen share detected:", {
        producerId,
        userId,
        appData,
      });

      if (consumedProducersRef.current.has(producerId)) return;

      await consume(
        producerId,
        currentDevice.rtpCapabilities,
        (stream: MediaStream) => {
          consumedProducersRef.current.add(producerId);

          setScreenShares((prev) => ({
            ...prev,
            [userId]: stream,
          }));
        }
      );
    };

    const handleScreenShareStopped = ({ userId }: { userId: string }) => {
      console.log("Screen share stopped:", userId);

      setScreenShares((prev) => {
        const newScreenShares = { ...prev };
        if (newScreenShares[userId]) {
          newScreenShares[userId].getTracks().forEach((track) => track.stop());
          delete newScreenShares[userId];
        }
        return newScreenShares;
      });
    };

    const handleUserUpdated = ({
      userId,
      micActive,
      camActive,
      isShareScreen,
    }: any) => {
      console.log("User updated:", {
        userId,
        micActive,
        camActive,
        isShareScreen,
      });
      setRemoteStreams((prevStreams) => {
        const newStreams = { ...prevStreams };
        if (newStreams[userId]) {
          newStreams[userId].getTracks().forEach((track) => {
            if (track.kind === "audio") {
              track.enabled = micActive;
            } else if (track.kind === "video") {
              track.enabled = camActive;
            }
          });
        }

        console.log("newStreams", newStreams);
        return newStreams;
      });
    };

    socket.on("newProducer", handleNewProducer);
    socket.on("userLeft", handleUserLeft);
    socket.on("userUpdated", handleUserUpdated);

    const cleanupNewScreenShare = onNewScreenShare(handleNewScreenShare);
    const cleanupScreenShareStopped = onScreenShareStopped(
      handleScreenShareStopped
    );

    return () => {
      socket.off("newProducer", handleNewProducer);
      socket.off("userLeft", handleUserLeft);
      cleanupNewScreenShare();
      cleanupScreenShareStopped();
    };
  }, [
    socket,
    joined,
    consumeAndAddTrack,
    deviceRef,
    onNewScreenShare,
    onScreenShareStopped,
    consume,
  ]);

  const handleJoin = async () => {
    if (!roomId || !socket) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      localStreamRef.current = stream;
      setLocalStream?.(stream);

      const { producers: existingProducers } = await joinRoom(roomId);
      setSearchParams({ room: roomId });

      const rtpCapabilities = await new Promise((resolve) => {
        socket.emit("getRouterRtpCapabilities", {}, resolve);
      });

      const mediasoupDevice = await loadDevice(rtpCapabilities as any);
      const transport = await createSendTransport();
      setSendTransport(transport as Transport);
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

      socket.emit("getActiveScreenShares", {}, (screenShares: any[]) => {
        if (screenShares && screenShares.length > 0) {
          console.log("Active screen shares in room:", screenShares);

          screenShares.forEach(async ({ producerId, userId }) => {
            if (consumedProducersRef.current.has(producerId)) return;

            await consume(
              producerId,
              mediasoupDevice.rtpCapabilities,
              (stream: MediaStream) => {
                consumedProducersRef.current.add(producerId);

                setScreenShares((prev) => ({
                  ...prev,
                  [userId]: stream,
                }));
              }
            );
          });
        }
      });
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
          {Object.keys(screenShares).length > 0 && (
            <div className="w-full mb-4">
              <ScreenShareDisplay streams={screenShares} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mt-4">
            {localStream && <Player stream={localStream} name="You" you />}
            {Object.entries(remoteStreams).map(([userId, stream]) => {
              const user = users.find((u) => u.id === userId);

              return (
                <Player
                  key={userId}
                  stream={stream}
                  name={`User ${userId}`}
                  micActive={user?.micActive}
                  camActive={user?.camActive}
                  isShareScreen={user?.isShareScreen}
                  you={false}
                />
              );
            })}
          </div>
        </>
      )}
      {joined && localStream && (
        <MediaControls
          localStream={localStream}
          sendTransport={sendTransport as Transport<AppData>}
        />
      )}
    </div>
  );
};

export default RoomPage;
