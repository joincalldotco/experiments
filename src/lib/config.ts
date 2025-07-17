import {
  RtpCodecCapability,
  TransportListenInfo,
  WorkerLogTag,
} from "mediasoup/node/lib/types";
import os from "os";

export const config = {
  listenIp: "0.0.0.0",
  listenPort: 3016,
  mediasoup: {
    numWorkers: Object.keys(os.cpus()).length,
    workerSettings: {
      logLevel: "debug",
      logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"] as WorkerLogTag[],
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
    },
    router: {
      mediaCodecs: [
        {
          kind: "audio",
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: "video",
          mimeType: "video/VP8",
          clockRate: 90000,
          parameters: {
            "x-google-start-bitrate": 1000,
          },
        },
      ] as RtpCodecCapability[],
    },
    webRtcTransport: {
      listenIps: [
        {
          ip: "0.0.0.0",
          announcedIp: "127.0.0.1",
        },
      ] as TransportListenInfo[],
      maxIncomingBitrate: 1500000,
      initialAvailableOutgoingBitrate: 1000000,
    },
    // Screen sharing specific settings
    screenSharing: {
      // Optimized encodings for screen sharing with multiple quality layers
      encodings: [
        // Simulcast layers for adaptive quality
        {
          rid: "high",
          maxBitrate: 5000000, // 5 Mbps for high quality
          maxFramerate: 30,
          priority: "high",
          networkPriority: "high",
          adaptivePtime: true,
          scalabilityMode: "L1T3", // Temporal scalability for smooth motion
          scaleResolutionDownBy: 1, // Full resolution
        },
        {
          rid: "medium",
          maxBitrate: 1000000, // 1 Mbps for medium quality
          maxFramerate: 15,
          priority: "medium",
          networkPriority: "medium",
          adaptivePtime: true,
          scalabilityMode: "L1T2",
          scaleResolutionDownBy: 2, // Half resolution
        },
        {
          rid: "low",
          maxBitrate: 500000, // 500 Kbps for low quality
          maxFramerate: 8,
          priority: "low",
          networkPriority: "low",
          adaptivePtime: true,
          scalabilityMode: "L1T1",
          scaleResolutionDownBy: 4, // Quarter resolution
        },
      ],
      // Optimized codec parameters for screen sharing
      codecOptions: {
        videoGoogleStartBitrate: 1000,
        videoGoogleMaxBitrate: 5000,
        videoGoogleMinBitrate: 300,
        videoGoogleStartFrameRate: 15, // Start with moderate framerate
        videoGoogleMaxFrameRate: 30,
        videoGoogleMinFrameRate: 8,
      },
      // Content hints for different types of screen content
      contentHints: {
        // For static content like slides, documents
        static: {
          maxFramerate: 5,
          maxBitrate: 1000000, // 1 Mbps is enough for static content
        },
        // For dynamic content like videos, animations
        dynamic: {
          maxFramerate: 30,
          maxBitrate: 5000000, // 5 Mbps for dynamic content
        },
        // For mixed content (default)
        mixed: {
          maxFramerate: 15,
          maxBitrate: 2500000, // 2.5 Mbps for mixed content
        },
      },
    },
  },
} as const;
