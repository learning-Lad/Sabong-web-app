import { handleAssistantRequest } from "../server/assistant.js";
// Vercel's Node.js Web Standard handler. This file is not part of the Vite client bundle.
export default {
  fetch(request: Request) {
    return handleAssistantRequest(request, process.env);
  },
};
