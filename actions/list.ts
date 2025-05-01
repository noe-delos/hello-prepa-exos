"use server";

import { revalidatePath } from "next/cache";

/**
 * Force revalidate the history list
 * This is needed because just invalidating the React Query cache
 * doesn't always trigger a UI refresh
 *
 * @param path The path to revalidate (default: "/")
 */
export async function revalidateHistoryList(path: string = "/") {
  revalidatePath(path);
  return { success: true };
}
