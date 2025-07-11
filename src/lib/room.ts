import {
  Router,
  Transport,
  Producer,
  Consumer,
  DataProducer,
  DataConsumer,
} from "mediasoup/node/lib/types";
import { config } from "./config";

export interface RoomPeer {
  id: string;
  transports: Transport[];
  producers: Producer[];
  consumers: Consumer[];
  dataProducers: DataProducer[];
  dataConsumers: DataConsumer[];
  lastSeen?: number;
}

export class Room {
  public peers: Map<string, RoomPeer> = new Map();
  public readonly PEER_TIMEOUT = 8000; // 8 seconds timeout

  constructor(public id: string, public router: Router) {}

  updatePeerActivity(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.lastSeen = Date.now();
    }
  }

  addPeer(peerId: string) {
    if (!this.peers.has(peerId)) {
      this.peers.set(peerId, {
        id: peerId,
        transports: [],
        producers: [],
        consumers: [],
        dataProducers: [],
        dataConsumers: [],
      });
    }
    return this.peers.get(peerId)!;
  }

  getPeer(peerId: string) {
    return this.peers.get(peerId);
  }

  async createRecvTransport() {
    const transport = await this.router.createWebRtcTransport({
      listenIps: config.mediasoup.webRtcTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });
    return transport;
  }

  async removePeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) {
      // Close all consumers
      for (const consumer of peer.consumers) {
        try {
          await consumer.close();
        } catch (error) {
          console.error(`Error closing consumer for peer ${peerId}:`, error);
        }
      }

      // Close all producers
      for (const producer of peer.producers) {
        try {
          await producer.close();
        } catch (error) {
          console.error(`Error closing producer for peer ${peerId}:`, error);
        }
      }

      // Close all data consumers
      for (const dataConsumer of peer.dataConsumers) {
        try {
          await dataConsumer.close();
        } catch (error) {
          console.error(
            `Error closing data consumer for peer ${peerId}:`,
            error
          );
        }
      }

      // Close all data producers
      for (const dataProducer of peer.dataProducers) {
        try {
          await dataProducer.close();
        } catch (error) {
          console.error(
            `Error closing data producer for peer ${peerId}:`,
            error
          );
        }
      }

      // Close all transports
      for (const transport of peer.transports) {
        try {
          await transport.close();
        } catch (error) {
          console.error(`Error closing transport for peer ${peerId}:`, error);
        }
      }
    }

    // Finally remove the peer from the map
    this.peers.delete(peerId);
  }
}
