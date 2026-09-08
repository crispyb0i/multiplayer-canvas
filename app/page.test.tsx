import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("home page", () => {
  it("communicates that the M0 foundation is ready", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Multiplayer Canvas" })).toBeInTheDocument();
    expect(screen.getByText(/workspace is ready for the curriculum/i)).toBeInTheDocument();
  });
});
