import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import Editor from "./editor";
import { executeYjsCommand, REMOTE_ORIGIN } from "../lib/yjs-document";
import type { CollaborationClient } from "../lib/collaboration-client";

const clients = vi.hoisted(
  () => [] as ConstructorParameters<typeof CollaborationClient>[0][],
);
vi.mock("../lib/collaboration-client", () => ({
  CollaborationClient: class {
    constructor(options: ConstructorParameters<typeof CollaborationClient>[0]) {
      clients.push(options);
    }
    connect() {}
    dispose() {}
    sendPresence() {}
  },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  clients.length = 0;
});

describe("editor interaction boundaries", () => {
  it("edits a restored collaborative shape and undoes only the local change in Strict Mode", () => {
    vi.stubEnv("NEXT_PUBLIC_COLLAB_URL", "ws://canvas.test");
    render(
      <StrictMode>
        <Editor
          collaborationAuth={{
            organizationId: "org",
            tokenProvider: async () => "token",
          }}
        />
      </StrictMode>,
    );
    const client = clients.at(-1)!;
    act(() => {
      executeYjsCommand(
        client.document,
        {
          type: "add",
          shape: {
            id: "remote",
            type: "text",
            text: "Remote label",
            x: 10,
            y: 10,
            width: 100,
            height: 40,
            fill: "#fff",
          },
        },
        REMOTE_ORIGIN,
      );
      client.onRemoteUpdate?.();
    });
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("button", { name: "text shape" }), {
      key: "Enter",
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Selected text" }), {
      target: { value: "Local label" },
    });
    expect(screen.getByText("Local label")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Remote label")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "text shape" }),
    ).toBeInTheDocument();
  });

  it("pans from a shape using viewBox units and clears Space when focus leaves", () => {
    render(<Editor />);
    const svg = screen.getByRole("application");
    Object.defineProperty(svg, "setPointerCapture", { value: vi.fn() });
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 450,
      bottom: 280,
      width: 450,
      height: 280,
      toJSON() {},
    });
    fireEvent.click(screen.getByRole("button", { name: "Add rectangle" }));
    fireEvent.keyDown(svg, { key: " " });
    // jsdom lacks PointerEvent coordinates, so use a MouseEvent carrying the
    // same pointer fields. Browser smoke checks cover native pointer capture.
    fireEvent(
      screen.getByRole("button", { name: "rectangle shape" }),
      new MouseEvent("pointerdown", {
        bubbles: true,
        clientX: 50,
        clientY: 50,
        button: 0,
      }),
    );
    fireEvent(
      svg,
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 100,
        clientY: 75,
      }),
    );
    expect(svg.querySelector("g[transform]")).toHaveAttribute(
      "transform",
      "translate(100 50) scale(1)",
    );
    fireEvent.blur(svg);
    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
    expect(svg.querySelector("g[transform]")).toHaveAttribute(
      "transform",
      "translate(0 0) scale(1)",
    );
  });
});
