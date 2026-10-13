const PROTOCOL = window.location.protocol;
const HOSTNAME = window.location.hostname;

// Client dev server usually runs on :5001 and server on :5000.
// Use the page hostname so other devices call the correct server host on the LAN.
export const API_URL = `${PROTOCOL}//${HOSTNAME}:5000`;
export const SOCKET_URL = API_URL;

export default {
  API_URL,
  SOCKET_URL
};
