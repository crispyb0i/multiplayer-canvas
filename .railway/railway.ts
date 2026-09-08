import { defineRailway, project, service } from "railway/iac";

// Last resort for a per-service CaC repo. Prefer one .railway file for the
// project and drop this if you later combine services into that file.
export const partial = "multiplayer-canvas";

export default defineRailway(() => {
  const multiplayer_canvas = service("multiplayer-canvas", {
    start: "npm run collab:start",
  });
  return project("multiplayer-canvas", {
    resources: [multiplayer_canvas],
  });
});
