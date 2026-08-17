import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import pino from "pino";

// Global in-memory Baileys singleton to maintain WebSocket connection across server actions/routes
interface BaileysSessionState {
  socket: any | null;
  status: "DISCONNECTED" | "CONNECTING" | "SCAN_QR" | "CONNECTED";
  qrCodeDataUrl: string | null;
  qrRaw: string | null;
  userInfo: { id: string; name?: string } | null;
  lastError: string | null;
  connectingPromise: Promise<void> | null;
}

const globalForBaileys = globalThis as unknown as {
  baileysSession?: BaileysSessionState;
};

export const baileysState: BaileysSessionState =
  globalForBaileys.baileysSession || {
    socket: null,
    status: "DISCONNECTED",
    qrCodeDataUrl: null,
    qrRaw: null,
    userInfo: null,
    lastError: null,
    connectingPromise: null,
  };

if (!globalForBaileys.baileysSession) {
  globalForBaileys.baileysSession = baileysState;
}

const AUTH_DIR = path.join(process.cwd(), ".baileys_auth");

function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
}

/**
 * Initializes or returns the existing Baileys socket connection
 */
export async function initBaileysSocket(): Promise<BaileysSessionState> {
  // If already connected, return
  if (baileysState.socket && baileysState.status === "CONNECTED") {
    return baileysState;
  }

  if (baileysState.connectingPromise) {
    await baileysState.connectingPromise;
    return baileysState;
  }

  baileysState.connectingPromise = (async () => {
    ensureAuthDir();
    baileysState.status = "CONNECTING";
    baileysState.lastError = null;

    try {
      const {
        default: makeWASocket,
        useMultiFileAuthState,
        DisconnectReason,
        fetchLatestBaileysVersion,
      } = await import("@whiskeysockets/baileys");

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 1015901307] as [number, number, number],
      }));

      const logger = pino({ level: "silent" });

      const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        browser: ["The Launch Feed", "Chrome", "1.0.0"],
        syncFullHistory: false,
      });

      baileysState.socket = sock;

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          baileysState.qrRaw = qr;
          baileysState.status = "SCAN_QR";
          try {
            baileysState.qrCodeDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              width: 260,
              color: {
                dark: "#000000",
                light: "#ffffff",
              },
            });
          } catch (e: any) {
            console.error("[Baileys QR Error]", e);
          }
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          baileysState.status = "DISCONNECTED";
          baileysState.qrCodeDataUrl = null;
          baileysState.qrRaw = null;
          baileysState.userInfo = null;
          baileysState.lastError = lastDisconnect?.error?.message || `Disconnected (${statusCode || "unknown"})`;

          if (shouldReconnect) {
            console.log("[Baileys] Connection closed, auto-reconnecting...");
            setTimeout(() => {
              baileysState.connectingPromise = null;
              initBaileysSocket().catch(console.error);
            }, 3000);
          } else {
            console.log("[Baileys] Logged out from WhatsApp. Clear session.");
            try {
              fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            } catch {}
          }
        } else if (connection === "open") {
          baileysState.status = "CONNECTED";
          baileysState.qrCodeDataUrl = null;
          baileysState.qrRaw = null;
          baileysState.lastError = null;
          const user = sock.user;
          baileysState.userInfo = user
            ? {
                id: user.id.replace(/:.*@/, "@"),
                name: user.name,
              }
            : null;
          console.log("[Baileys] WhatsApp Socket connected successfully as:", baileysState.userInfo);
        }
      });
    } catch (err: any) {
      console.error("[Baileys Init Error]", err);
      baileysState.status = "DISCONNECTED";
      baileysState.lastError = err.message || String(err);
    } finally {
      baileysState.connectingPromise = null;
    }
  })();

  await baileysState.connectingPromise;
  return baileysState;
}

/**
 * Returns current snapshot of the Baileys session
 */
export async function getBaileysStatus(): Promise<{
  status: "DISCONNECTED" | "CONNECTING" | "SCAN_QR" | "CONNECTED";
  qrCodeDataUrl: string | null;
  userInfo: { id: string; name?: string } | null;
  lastError: string | null;
}> {
  // If we haven't started and auth files exist, try auto-connecting
  if (baileysState.status === "DISCONNECTED" && fs.existsSync(path.join(AUTH_DIR, "creds.json"))) {
    initBaileysSocket().catch(console.error);
  }

  return {
    status: baileysState.status,
    qrCodeDataUrl: baileysState.qrCodeDataUrl,
    userInfo: baileysState.userInfo,
    lastError: baileysState.lastError,
  };
}

/**
 * Disconnects and deletes credentials
 */
export async function disconnectBaileys(): Promise<void> {
  try {
    if (baileysState.socket) {
      await baileysState.socket.logout().catch(() => {});
      baileysState.socket.end(undefined);
    }
  } catch {}

  baileysState.socket = null;
  baileysState.status = "DISCONNECTED";
  baileysState.qrCodeDataUrl = null;
  baileysState.qrRaw = null;
  baileysState.userInfo = null;
  baileysState.lastError = null;

  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  } catch {}
}

/**
 * Sends text message to WhatsApp group (chatId ending in @g.us) or user (chatId ending in @c.us / @s.whatsapp.net)
 */
export async function sendBaileysMessage(
  rawChatId: string,
  text: string
): Promise<{ success: boolean; message: string }> {
  // Ensure socket is active
  if (!baileysState.socket || baileysState.status !== "CONNECTED") {
    await initBaileysSocket();
  }

  if (!baileysState.socket || baileysState.status !== "CONNECTED") {
    return {
      success: false,
      message: `WhatsApp is not connected (Status: ${baileysState.status}). Please scan the QR code in the admin dashboard.`,
    };
  }

  let chatId = rawChatId.trim();
  if (!chatId.includes("@")) {
    if (chatId.length > 15 || chatId.startsWith("120")) {
      chatId = `${chatId}@g.us`;
    } else {
      chatId = `${chatId.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
    }
  }

  try {
    const res = await baileysState.socket.sendMessage(chatId, {
      text,
    });

    if (res?.key?.id) {
      return {
        success: true,
        message: `Successfully delivered message to WhatsApp (${chatId})`,
      };
    } else {
      return {
        success: false,
        message: "Message dispatched but message key was not confirmed.",
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Baileys send error: ${err.message || String(err)}`,
    };
  }
}

/**
 * Fetches all participating WhatsApp groups with their names and IDs
 */
export async function fetchBaileysGroups(): Promise<Array<{ id: string; name: string }>> {
  if (!baileysState.socket || baileysState.status !== "CONNECTED") {
    await initBaileysSocket();
  }

  if (!baileysState.socket || baileysState.status !== "CONNECTED") {
    throw new Error("WhatsApp is not connected. Please scan the QR code first.");
  }

  try {
    const groups = await baileysState.socket.groupFetchAllParticipating();
    return Object.values(groups).map((g: any) => ({
      id: g.id,
      name: g.subject || "Unnamed Group",
    }));
  } catch (err: any) {
    throw new Error(`Failed to fetch WhatsApp groups: ${err.message || String(err)}`);
  }
}
