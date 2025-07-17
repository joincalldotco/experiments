// Example end-to-end test for screen sharing
// This would typically be run with a framework like Cypress or Playwright

describe("Screen Sharing", () => {
  beforeEach(() => {
    // Mock the navigator.mediaDevices.getDisplayMedia API
    cy.window().then((win) => {
      cy.stub(win.navigator.mediaDevices, "getDisplayMedia").resolves({
        getTracks: () => [
          {
            kind: "video",
            addEventListener: cy.stub(),
            getSettings: () => ({ width: 1920, height: 1080 }),
          },
        ],
        getVideoTracks: () => [
          {
            addEventListener: cy.stub(),
            getSettings: () => ({ width: 1920, height: 1080 }),
          },
        ],
      });
    });

    // Visit the room page
    cy.visit("/");

    // Enter a room ID and join
    cy.get('input[placeholder="Room ID"]').type("test-room");
    cy.contains("Join Room").click();

    // Wait for the room to load
    cy.contains("Leave Room").should("be.visible");
  });

  it("should start screen sharing when the button is clicked", () => {
    // Click the Share Screen button
    cy.contains("Share Screen").click();

    // Verify that screen sharing has started
    cy.contains("Stop Sharing").should("be.visible");

    // Verify that the screen share indicator is visible
    cy.get(".animate-pulse").should("be.visible");
  });

  it("should stop screen sharing when the stop button is clicked", () => {
    // First start screen sharing
    cy.contains("Share Screen").click();
    cy.contains("Stop Sharing").should("be.visible");

    // Then stop it
    cy.contains("Stop Sharing").click();

    // Verify that screen sharing has stopped
    cy.contains("Share Screen").should("be.visible");
    cy.contains("Stop Sharing").should("not.exist");
  });

  it("should display another user's screen share", () => {
    // Mock receiving a screen share from another user
    cy.window().then((win) => {
      // Simulate the socket event for a new screen share
      win.socketIoClient.emit("newScreenShare", {
        producerId: "mock-producer-id",
        userId: "other-user",
        appData: { mediaType: "screenShare" },
      });
    });

    // Verify that the screen share display is visible
    cy.get(".screen-share-display").should("be.visible");
    cy.contains("other-user's Screen").should("be.visible");
  });

  it("should handle multiple screen shares", () => {
    // Mock receiving screen shares from multiple users
    cy.window().then((win) => {
      // Simulate the socket events for new screen shares
      win.socketIoClient.emit("newScreenShare", {
        producerId: "mock-producer-id-1",
        userId: "user1",
        appData: { mediaType: "screenShare" },
      });

      win.socketIoClient.emit("newScreenShare", {
        producerId: "mock-producer-id-2",
        userId: "user2",
        appData: { mediaType: "screenShare" },
      });
    });

    // Verify that both screen shares are visible in the thumbnails
    cy.contains("user1").should("be.visible");
    cy.contains("user2").should("be.visible");

    // Click on the second user's thumbnail
    cy.contains("user2").click();

    // Verify that the main display shows the selected user's screen
    cy.get(".screen-share-display")
      .contains("user2's Screen")
      .should("be.visible");
  });
});
