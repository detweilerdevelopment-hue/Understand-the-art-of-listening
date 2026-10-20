// @vitest-environment jsdom
import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Simulator } from "../src/components/simulator";
import type { Analytics } from "../src/lib/analytics";
it("emits one device session across start, pause, resume, and stop", async () => {
  const request = vi.fn().mockResolvedValue({ duplicate: false }),
    error = vi.fn();
  render(
    <Simulator
      stations={
        [
          { id: "test-station", name: "Test station", location: "Lab" },
        ] as Analytics["stations"]
      }
      writable
      request={request}
      onUpdate={vi.fn()}
      onError={error}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Start listening" }));
  await screen.findByText("Listening in progress.");
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  await screen.findByText("Taking a pause.");
  fireEvent.click(screen.getByRole("button", { name: "Resume" }));
  await screen.findByText("Listening in progress.");
  fireEvent.click(screen.getByRole("button", { name: "Stop session" }));
  await waitFor(() => expect(request.mock.calls).toHaveLength(5));
  const payloads = request.mock.calls.map((c) => c[1]);
  expect(payloads.map((e) => e.type)).toEqual([
    "station_heartbeat",
    "playback_started",
    "playback_paused",
    "playback_resumed",
    "playback_stopped",
  ]);
  expect(new Set(payloads.slice(1).map((e) => e.sessionKey)).size).toBe(1);
  expect(new Set(payloads.map((e) => e.eventId)).size).toBe(5);
  expect(error).not.toHaveBeenCalled();
});
