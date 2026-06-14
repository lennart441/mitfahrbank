export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function rideStatusBadge(status: string) {
  const map: Record<string, string> = {
    waiting: "badge-waiting",
    driving: "badge-driving",
    completed: "badge-done",
    cancelled: "badge-waiting",
  };
  return map[status] ?? "badge-waiting";
}

export function rideStatusLabel(status: string, variant: "driver" | "seeker" = "seeker") {
  if (variant === "driver") {
    const driverMap: Record<string, string> = {
      waiting: "Wartend",
      driving: "Übernommen",
    };
    if (driverMap[status]) return driverMap[status];
  }
  const map: Record<string, string> = {
    waiting: "Warte auf Fahrer",
    driving: "Fahrer unterwegs",
    completed: "Abgeschlossen",
    cancelled: "Abgebrochen",
  };
  return map[status] ?? status;
}

export function shoppingStatusBadge(status: string) {
  if (status === "open") return "badge-waiting";
  if (status === "claimed") return "badge-driving";
  return "badge-done";
}

export function shoppingStatusLabel(status: string) {
  const map: Record<string, string> = {
    open: "Offen",
    claimed: "Reserviert",
    done: "Erledigt",
  };
  return map[status] ?? status;
}
