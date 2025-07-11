import { Worker } from "mediasoup/node/lib/types";
import { Socket, Server as SocketIOServer } from "socket.io";
import { config } from "./config";
import db, { initDb } from "./db";
import { Room } from "./room";
import { RoomRecorder } from "./recorder";
import { createTransport } from "./transport";
import { createWorker } from "./worker";

const AUTH_TOKEN = "demo-token";

const rooms: Map<string, Room> = new Map();
let mediasoupWorker: Worker;
const recorder = new RoomRecorder();

async function createRoom(roomId: string) {
  const router = await mediasoupWorker.createRouter({
    mediaCodecs: config.mediasoup.router.mediaCodecs,
  });
  const room = new Room(roomId, router);
  rooms.set(roomId, room);
  return room;
}

// Initialize db on server start
initDb();

const socketIoConnection = async (io: SocketIOServer) => {
  if (!mediasoupWorker) {
    mediasoupWorker = await createWorker();
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token !== AUTH_TOKEN) {
      return next(new Error("Authentication error"));
    }
    next();
  });

  io.on("connection", (socket: Socket) => {
    let currentRoom: Room | undefined;
    let peerId = socket.id;

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log(`[Room ${currentRoom?.id}] Peer ${peerId} disconnected`);
      if (currentRoom) {
        try {
          // Notify other users in the room about the disconnection
          socket
            .to(currentRoom.id)
            .emit("user-disconnected", { userId: peerId });

          // Remove from room
          await currentRoom.removePeer(peerId);

          // Remove from database
          await db.read();
          const dbRoom = db.data!.rooms.find((r) => r.id === currentRoom!.id);
          if (dbRoom) {
            dbRoom.users = dbRoom.users.filter((u) => u !== peerId);
            await db.write();
          }

          // Remove user from db users if not in any room
          const stillInRoom = db.data!.rooms.some((r) =>
            r.users.includes(peerId)
          );
          if (!stillInRoom) {
            db.data!.users = db.data!.users.filter((u) => u.id !== peerId);
            await db.write();
          }

          // Clean up empty room
          if (currentRoom.peers.size === 0) {
            rooms.delete(currentRoom.id);
            db.data!.rooms = db.data!.rooms.filter(
              (r) => r.id !== currentRoom!.id
            );
            await db.write();
          }
        } catch (error) {
          console.error(`Error handling disconnect for peer ${peerId}:`, error);
        }
      }
    });

    // Handle heartbeat
    socket.on("heartbeat", () => {
      if (currentRoom) {
        currentRoom.updatePeerActivity(peerId);
      }
    });

    // Handle peer list sync request
    socket.on("syncPeers", (callback) => {
      if (!currentRoom) {
        callback({ peers: [] });
        return;
      }

      const activePeers = Array.from(currentRoom.peers.entries())
        .filter(([id, peer]) => {
          const isActive =
            Date.now() - (peer.lastSeen || 0) <
            (currentRoom?.PEER_TIMEOUT || 0);
          if (!isActive) {
            console.log(
              `[Room ${currentRoom?.id}] Peer ${id} appears inactive during sync`
            );
          }
          return isActive;
        })
        .map(([id]) => id);

      callback({ peers: activePeers });
    });

    socket.on("createRoom", async ({ roomId }, callback) => {
      try {
        const room = await createRoom(roomId);
        callback({ created: true });
      } catch (error) {
        console.error("Error creating room:", error);
        callback({ error: "Failed to create room" });
      }
    });

    socket.on("joinRoom", async ({ roomId, token }, callback) => {
      if (token !== AUTH_TOKEN) return callback({ error: "Invalid token" });
      let room = rooms.get(roomId);
      if (!room) {
        const router = await mediasoupWorker.createRouter({
          mediaCodecs: config.mediasoup.router.mediaCodecs,
        });
        room = new Room(roomId, router);
        rooms.set(roomId, room);
      }
      currentRoom = room;
      room.addPeer(peerId);

      console.log(`[Room ${roomId}] Peer ${peerId} joined`);
      console.log(
        `[Room ${roomId}] Current peers:`,
        Array.from(room.peers.keys())
      );

      // Join the socket.io room
      socket.join(roomId);

      // Add user to db
      await db.read();
      let dbRoom = db.data!.rooms.find((r) => r.id === roomId);
      if (dbRoom && !dbRoom.users.includes(peerId)) {
        dbRoom.users.push(peerId);
        await db.write();
      }
      if (!db.data!.users.find((u) => u.id === peerId)) {
        db.data!.users.push({ id: peerId, name: peerId });
        await db.write();
      }
      callback({ joined: true });
    });

    socket.on("createWebRtcTransport", async (data, callback) => {
      if (!currentRoom) return callback({ error: "No room joined" });
      const { transport, params } = await createTransport(currentRoom.router);
      currentRoom.getPeer(peerId)?.transports.push(transport);
      callback(params);
    });

    socket.on(
      "connectWebRtcTransport",
      async ({ transportId, dtlsParameters }, callback) => {
        if (!currentRoom) return callback({ error: "No room joined" });
        const peer = currentRoom.getPeer(peerId);
        const transport = peer?.transports.find((t) => t.id === transportId);
        if (!transport) return callback({ error: "Transport not found" });
        await transport.connect({ dtlsParameters });
        callback({ connected: true });
      }
    );

    socket.on(
      "produce",
      async ({ transportId, kind, rtpParameters }, callback) => {
        if (!currentRoom) return callback({ error: "No room joined" });
        const peer = currentRoom.getPeer(peerId);
        const transport = peer?.transports.find((t) => t.id === transportId);
        if (!transport) return callback({ error: "Transport not found" });
        const producer = await transport.produce({ kind, rtpParameters });
        peer?.producers.push(producer);

        console.log(
          `[Room ${currentRoom.id}] Peer ${peerId} produced ${kind}`,
          {
            producerId: producer.id,
            transportId,
          }
        );

        // Notify all other users in the room about the new producer
        socket.to(currentRoom.id).emit("newProducer", {
          producerId: producer.id,
          userId: peerId,
          kind,
        });

        console.log(
          `[Room ${currentRoom.id}] Notified other peers about new producer`,
          {
            producerId: producer.id,
            userId: peerId,
            kind,
          }
        );

        callback({ id: producer.id });
      }
    );

    socket.on(
      "produceData",
      async (
        { transportId, sctpStreamParameters, label, protocol },
        callback
      ) => {
        if (!currentRoom) return callback({ error: "No room joined" });
        const peer = currentRoom.getPeer(peerId);
        const transport = peer?.transports.find((t) => t.id === transportId);
        if (!transport) return callback({ error: "Transport not found" });
        const dataProducer = await transport.produceData({
          sctpStreamParameters,
          label,
          protocol,
        });
        peer?.dataProducers.push(dataProducer);
        callback({ id: dataProducer.id });
      }
    );

    socket.on(
      "consume",
      async ({ transportId, producerId, rtpCapabilities }, callback) => {
        if (!currentRoom) return callback({ error: "No room joined" });
        const peer = currentRoom.getPeer(peerId);
        const transport = peer?.transports.find((t) => t.id === transportId);
        if (!transport) return callback({ error: "Transport not found" });
        const producerPeer = Array.from(currentRoom.peers.values()).find((p) =>
          p.producers.some((pr) => pr.id === producerId)
        );
        const producer = producerPeer?.producers.find(
          (pr) => pr.id === producerId
        );
        if (!producer) return callback({ error: "Producer not found" });
        if (!currentRoom.router.canConsume({ producerId, rtpCapabilities })) {
          return callback({ error: "Cannot consume" });
        }
        const consumer = await transport.consume({
          producerId,
          rtpCapabilities,
          paused: false,
        });
        peer?.consumers.push(consumer);
        callback({
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          type: consumer.type,
          producerPaused: consumer.producerPaused,
        });
      }
    );

    socket.on(
      "consumeData",
      async ({ transportId, dataProducerId }, callback) => {
        if (!currentRoom) return callback({ error: "No room joined" });
        const peer = currentRoom.getPeer(peerId);
        const transport = peer?.transports.find((t) => t.id === transportId);
        if (!transport) return callback({ error: "Transport not found" });
        const dataProducerPeer = Array.from(currentRoom.peers.values()).find(
          (p) => p.dataProducers.some((dp) => dp.id === dataProducerId)
        );
        const dataProducer = dataProducerPeer?.dataProducers.find(
          (dp) => dp.id === dataProducerId
        );
        if (!dataProducer) return callback({ error: "DataProducer not found" });
        const dataConsumer = await transport.consumeData({ dataProducerId });
        peer?.dataConsumers.push(dataConsumer);
        callback({
          id: dataConsumer.id,
          dataProducerId,
          sctpStreamParameters: dataConsumer.sctpStreamParameters,
          label: dataConsumer.label,
          protocol: dataConsumer.protocol,
        });
      }
    );

    socket.on("getRouterRtpCapabilities", (data, callback) => {
      if (!currentRoom) return callback({ error: "No room joined" });
      callback(currentRoom.router.rtpCapabilities);
    });

    socket.on("getRoomProducers", (data, callback) => {
      if (!currentRoom) return callback([]);
      // Return all producer IDs except the current user's
      const producerIds = Array.from(currentRoom.peers.values())
        .filter((p) => p.id !== peerId)
        .flatMap((p) => p.producers.map((pr) => pr.id));
      callback(producerIds);
    });

    socket.on("getRoomProducersWithUsers", (data, callback) => {
      if (!currentRoom) return callback([]);
      // Return all producer IDs with their user IDs except the current user's
      const producersWithUsers = Array.from(currentRoom.peers.values())
        .filter((p) => p.id !== peerId)
        .flatMap((p) =>
          p.producers.map((pr) => ({
            producerId: pr.id,
            userId: p.id,
          }))
        );

      console.log(
        `[Room ${currentRoom.id}] Getting producers for peer ${peerId}`,
        {
          producers: producersWithUsers,
        }
      );

      callback(producersWithUsers);
    });

    // Handle recording requests
    socket.on("startRecording", async ({ userId }, callback) => {
      if (!currentRoom) {
        callback({ error: "Not in a room" });
        return;
      }

      try {
        const recordingId = await recorder.startRecording(currentRoom, userId);
        callback({ recordingId });
      } catch (error) {
        console.error("Error starting recording:", error);
        callback({ error: "Failed to start recording" });
      }
    });

    socket.on("stopRecording", async ({ recordingId }, callback) => {
      try {
        const result = await recorder.stopRecording(recordingId);
        callback(result);
      } catch (error) {
        console.error("Error stopping recording:", error);
        callback({ error: "Failed to stop recording" });
      }
    });

    socket.on("getRecordingStatus", async ({ recordingId }, callback) => {
      try {
        const status = await recorder.getRecordingStatus(recordingId);
        callback(status);
      } catch (error) {
        console.error("Error getting recording status:", error);
        callback({ error: "Failed to get recording status" });
      }
    });

    socket.on("getAllRecordings", async (callback) => {
      try {
        const recordings = await recorder.getAllRecordings();
        callback(recordings);
      } catch (error) {
        console.error("Error getting all recordings:", error);
        callback({ error: "Failed to get recordings" });
      }
    });
  });
};

export { socketIoConnection };
