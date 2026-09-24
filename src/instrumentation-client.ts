import { reportClientError } from "@/lib/errors/reportClient";

// Yakalanmamış tarayıcı hataları ve reddedilen promise'ler (bkz. lib/errors/reportClient.ts).
window.addEventListener("error", (event) => {
  reportClientError(event.error ?? event.message, "window.error");
});

window.addEventListener("unhandledrejection", (event) => {
  reportClientError(event.reason, "unhandledrejection");
});
