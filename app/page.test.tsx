import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Home from "./page";

afterEach(cleanup);

describe("home page", () => {
  it("renders the collaborative editor and adds a rectangle", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: "Multiplayer Canvas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("application", { name: "Drawing canvas" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add rectangle" }));
    expect(screen.getByText("Selected: rectangle")).toBeInTheDocument();
  });

  it("edits and removes a selected text shape with keyboard input", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Add text" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Selected text" }), {
      target: { value: "Updated label" },
    });
    expect(screen.getByText("Updated label")).toBeInTheDocument();
    fireEvent.keyDown(
      screen.getByRole("application", { name: "Drawing canvas" }),
      { key: "Delete" },
    );
    expect(screen.getByText("Nothing selected")).toBeInTheDocument();
  });
});
