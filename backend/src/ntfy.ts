import { config } from "./config.js";

export async function notifyDrivers(
  title: string,
  message: string,
  topics: string[],
): Promise<void> {
  if (!topics.length || !config.ntfy.enabled) return;

  const base = config.ntfy.baseUrl.replace(/\/$/, "");

  await Promise.allSettled(
    topics.map(async (topic) => {
      const url = `${base}/${encodeURIComponent(topic)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Title: title,
          Tags: "car",
          Priority: "4",
        },
        body: message,
      });
      if (!res.ok) {
        console.warn(`ntfy publish failed for ${topic}: ${res.status}`);
      }
    }),
  );
}
