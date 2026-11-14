export type RecordData = Record<string, any>;
let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
export async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "x-csrf-token": csrf } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await r
    .json()
    .catch(() => ({ message: "Unexpected server response" }));
  if (!r.ok)
    throw Error(
      typeof data.message === "string"
        ? data.message
        : JSON.stringify(data.message || data),
    );
  return data;
}
export const uid = () => crypto.randomUUID();
export const today = () => new Date().toISOString().slice(0, 10);
export const time = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const minutes = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
export const label = (s: string) => s.toLowerCase().replaceAll("_", " ").replace(/\binstitutions?\b/g, (word) => word === "institutions" ? "schools" : "school");
export const dateLabel = (s: string) =>
  s
    ? new Date(s).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
