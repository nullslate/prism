import { invoke } from "@tauri-apps/api/core";

type LogLevel = "debug" | "info" | "warn" | "error";

const PREFIX = "[prism]";

let debugEnabled = false;

export function setDebugEnabled(enabled: boolean) {
  debugEnabled = enabled;
}

function send(level: LogLevel, message: string) {
  invoke("log_message", { level, message }).catch(() => {});
}

function format(...args: unknown[]): string {
  return args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
}

const BANNER = `
 ██████╗ ██████╗ ██╗███████╗███╗   ███╗
 ██╔══██╗██╔══██╗██║██╔════╝████╗ ████║
 ██████╔╝██████╔╝██║███████╗██╔████╔██║
 ██╔═══╝ ██╔══██╗██║╚════██║██║╚██╔╝██║
 ██║     ██║  ██║██║███████║██║ ╚═╝ ██║
 ╚═╝     ╚═╝  ╚═╝╚═╝╚══════╝╚═╝     ╚═╝`;

export function printBanner(config: { theme: string; vault: string; debug: boolean }) {
  console.log(
    `%c${BANNER}%c\n\n` +
    `  %cv0.6.0%c  theme: %c${config.theme}%c  vault: %c${config.vault}%c\n`,
    "color: #b48ead; font-weight: bold",
    "",
    "color: #a3be8c; font-weight: bold",
    "color: #d8dee9",
    "color: #88c0d0",
    "color: #d8dee9",
    "color: #88c0d0",
    "color: #d8dee9",
  );
  if (config.debug) {
    console.log("%c  debug mode enabled", "color: #ebcb8b");
  }
}

export const log = {
  debug(...args: unknown[]) {
    if (!debugEnabled) return;
    const msg = format(...args);
    console.debug(PREFIX, msg);
    send("debug", msg);
  },

  info(...args: unknown[]) {
    const msg = format(...args);
    console.info(PREFIX, msg);
    send("info", msg);
  },

  warn(...args: unknown[]) {
    const msg = format(...args);
    console.warn(PREFIX, msg);
    send("warn", msg);
  },

  error(...args: unknown[]) {
    const msg = format(...args);
    console.error(PREFIX, msg);
    send("error", msg);
  },
};
