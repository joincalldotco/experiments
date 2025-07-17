import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ScreenShareDisplay from "../ScreenShareDisplay";

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback: any) {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("ScreenShareDisplay", () => {
  // Mock MediaStream and video tracks
  const createMockStream = () => {
    const mockTrack = {
      id: Math.random().toString(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      getSettings: () => ({ width: 1920, height: 1080 }),
    };

    return {
      id: Math.random().toString(),
      getVideoTracks: () => [mockTrack],
      getTracks: () => [mockTrack],
    };
  };

  // Mock HTMLVideoElement.srcObject setter
  Object.defineProperty(HTMLVideoElement.prototype, "srcObject", {
    set: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders nothing when no streams are provided", () => {
    const { container } = render(<ScreenShareDisplay streams={{}} />);
    expect(container.firstChild).toBeNull();
  });

  test("renders a single screen share", () => {
    const mockStream = createMockStream();
    const streams = { user1: mockStream as unknown as MediaStream };

    render(<ScreenShareDisplay streams={streams} />);

    // Check that the video element exists
    const videoElement = document.querySelector("video");
    expect(videoElement).toBeInTheDocument();

    // Check that the user label is displayed
    expect(screen.getByText(/user1/)).toBeInTheDocument();
  });

  test("renders multiple screen shares with thumbnails", () => {
    const mockStream1 = createMockStream();
    const mockStream2 = createMockStream();
    const streams = {
      user1: mockStream1 as unknown as MediaStream,
      user2: mockStream2 as unknown as MediaStream,
    };

    render(<ScreenShareDisplay streams={streams} />);

    // Check that we have the main video and thumbnails
    const videoElements = document.querySelectorAll("video");
    expect(videoElements.length).toBe(3); // Main video + 2 thumbnails

    // Check that both user labels are displayed
    expect(screen.getByText(/user1/)).toBeInTheDocument();
    expect(screen.getByText(/user2/)).toBeInTheDocument();
  });

  test("allows switching between screen shares", () => {
    const mockStream1 = createMockStream();
    const mockStream2 = createMockStream();
    const streams = {
      user1: mockStream1 as unknown as MediaStream,
      user2: mockStream2 as unknown as MediaStream,
    };

    const onSelect = jest.fn();

    render(<ScreenShareDisplay streams={streams} onSelect={onSelect} />);

    // Find the thumbnail for user2
    const user2Thumbnail = screen.getByText(/user2/).closest("div");

    // Click on the thumbnail
    fireEvent.click(user2Thumbnail!);

    // Check that onSelect was called with the correct user ID
    expect(onSelect).toHaveBeenCalledWith("user2");
  });

  test("handles stream removal gracefully", () => {
    const mockStream1 = createMockStream();
    const mockStream2 = createMockStream();
    const streams = {
      user1: mockStream1 as unknown as MediaStream,
      user2: mockStream2 as unknown as MediaStream,
    };

    const { rerender } = render(<ScreenShareDisplay streams={streams} />);

    // Remove user1's stream
    const updatedStreams = {
      user2: mockStream2 as unknown as MediaStream,
    };

    rerender(<ScreenShareDisplay streams={updatedStreams} />);

    // Check that only user2's label is displayed
    expect(screen.queryByText(/user1/)).not.toBeInTheDocument();
    expect(screen.getByText(/user2/)).toBeInTheDocument();
  });
});
