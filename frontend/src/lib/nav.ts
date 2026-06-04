export type AppView = "home" | "seeker" | "driver" | "shopping" | "profile";

export const navItems: { id: AppView; label: string; short: string }[] = [
  { id: "home", label: "Start", short: "Start" },
  { id: "seeker", label: "Fahrt suchen", short: "Suchen" },
  { id: "driver", label: "Als Fahrer", short: "Fahrer" },
  { id: "shopping", label: "Einkaufshilfe", short: "Einkauf" },
  { id: "profile", label: "Profil", short: "Profil" },
];
