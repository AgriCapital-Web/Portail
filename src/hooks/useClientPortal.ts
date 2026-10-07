export const isOnClientPortal = (): boolean => {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname.toLowerCase();
  return host === "client.agricapital.ci" || host.startsWith("client-") || host.includes("portail");
};
