import { cookies } from "next/headers";

const MODERATOR_COOKIE = "beyoglu_moderator_session";

// Demo amaçlı sabit tek moderatör hesabı. Gerçek bir sistemde bu bilgiler
// veritabanında hash'lenmiş şekilde saklanır ve birden fazla moderatör desteklenir.
export const MODERATOR_USERNAME = "Thurdew";
const MODERATOR_PASSWORD = "19031903190";

export function checkModeratorCredentials(username: string, password: string): boolean {
  return username === MODERATOR_USERNAME && password === MODERATOR_PASSWORD;
}

export async function createModeratorSession() {
  const cookieStore = await cookies();
  cookieStore.set(MODERATOR_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function isModeratorSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(MODERATOR_COOKIE)?.value === "1";
}

export async function destroyModeratorSession() {
  const cookieStore = await cookies();
  cookieStore.delete(MODERATOR_COOKIE);
}
