// Unit tests for useScreenShare hook
// Note: These are example tests that would require a testing framework like Jest or Vitest

import { renderHook, act } from "@testing-library/react-hooks";
import { useScreenShare } from "../useScreenShare";

// Mock the useSocket hook
jest.mock("../useSocket", () => ({
  useSocket: () => ({
    socket: {
      emit: jest.fn((event, data, callback) => {
        if (event === "startScreenShare") {
          callback({ id: "mock-producer-id" });
        } else if (event === "stopScreenShare") {
          callback({ stopped: true });
        }
      }),
      on: jest.fn(),
      off: jest.fn(),
    },
    connected: true,
  }),
}));

// Mock navigator.mediaDevices.getDisplayMedia
const mockTrack = {
  addEventListener: jest.fn(),
  stop: jest.fn(),
};

const mockStream = {
  getVideoTracks: () => [mockTrack],
  getTracks: () => [mockTrack],
};

global.navigator.mediaDevices = {
  getDisplayMedia: jest.fn().mockResolvedValue(mockStream),
} as any;

describe("useScreenShare", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should initialize with default values", () => {
    const { result } = renderHook(() => useScreenShare());

    expect(result.current.isScreenSharing).toBe(false);
    expect(result.current.screenShareStream).toBe(null);
    expect(result.current.error).toBe(null);
  });

  test("should start screen sharing", async () => {
    const mockTransport = {
      id: "mock-transport-id",
      produce: jest.fn().mockResolvedValue({
        id: "mock-producer-id",
        rtpParameters: {},
        close: jest.fn(),
      }),
    };

    const { result, waitForNextUpdate } = renderHook(() => useScreenShare());

    act(() => {
      result.current.startScreenShare(mockTransport as any);
    });

    await waitForNextUpdate();

    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalled();
    expect(mockTransport.produce).toHaveBeenCalled();
    expect(result.current.isScreenSharing).toBe(true);
    expect(result.current.screenShareStream).toBe(mockStream);
  });

  test("should handle permission denial", async () => {
    const mockError = new Error("Permission denied");
    mockError.name = "NotAllowedError";

    global.navigator.mediaDevices.getDisplayMedia = jest
      .fn()
      .mockRejectedValue(mockError);

    const mockTransport = {
      id: "mock-transport-id",
      produce: jest.fn(),
    };

    const { result, waitForNextUpdate } = renderHook(() => useScreenShare());

    act(() => {
      result.current.startScreenShare(mockTransport as any);
    });

    await waitForNextUpdate();

    expect(result.current.error).toBe("Screen sharing permission denied");
    expect(result.current.isScreenSharing).toBe(false);
  });

  test("should stop screen sharing", async () => {
    // First start screen sharing
    const mockProducer = {
      id: "mock-producer-id",
      rtpParameters: {},
      close: jest.fn(),
    };

    const mockTransport = {
      id: "mock-transport-id",
      produce: jest.fn().mockResolvedValue(mockProducer),
    };

    const { result, waitForNextUpdate } = renderHook(() => useScreenShare());

    act(() => {
      result.current.startScreenShare(mockTransport as any);
    });

    await waitForNextUpdate();

    // Then stop it
    act(() => {
      result.current.stopScreenShare();
    });

    expect(mockProducer.close).toHaveBeenCalled();
    expect(mockTrack.stop).toHaveBeenCalled();
    expect(result.current.isScreenSharing).toBe(false);
    expect(result.current.screenShareStream).toBe(null);
  });

  test("should handle socket events for screen sharing", () => {
    const { result } = renderHook(() => useScreenShare());

    const mockCallback = jest.fn();
    const cleanup = result.current.onNewScreenShare(mockCallback);

    expect(result.current.socket.on).toHaveBeenCalledWith(
      "newScreenShare",
      mockCallback
    );

    cleanup();

    expect(result.current.socket.off).toHaveBeenCalledWith(
      "newScreenShare",
      mockCallback
    );
  });
});
