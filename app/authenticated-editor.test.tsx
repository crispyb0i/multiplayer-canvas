import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import AuthenticatedEditor from "./authenticated-editor";

const auth = vi.hoisted(() => ({
  userId: "alice",
  organization: { id: "one" },
  getToken: async () => "token",
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: auth.getToken,
    isLoaded: true,
    isSignedIn: true,
    userId: auth.userId,
  }),
  useOrganization: () => ({ organization: auth.organization }),
  OrganizationSwitcher: () => null,
}));
vi.mock("./editor", () => ({
  default: function Replica() {
    const [label, setLabel] = useState("");
    return (
      <input
        aria-label="Replica state"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
      />
    );
  },
}));
afterEach(cleanup);

it("discards the replica on workspace or account switches", () => {
  const { rerender } = render(<AuthenticatedEditor />);
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "private diagram" },
  });
  rerender(<AuthenticatedEditor />);
  expect(screen.getByRole("textbox")).toHaveValue("private diagram");
  auth.organization = { id: "two" };
  rerender(<AuthenticatedEditor />);
  expect(screen.getByRole("textbox")).toHaveValue("");
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "another diagram" },
  });
  auth.userId = "bob";
  rerender(<AuthenticatedEditor />);
  expect(screen.getByRole("textbox")).toHaveValue("");
});
