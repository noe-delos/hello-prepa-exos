// src/app/actions/generations.ts
"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { Generation } from "@/types";

export async function getGenerations(userId: string, limit = 10, offset = 0) {
  console.log("[Generations Action] Getting generations for user:", userId);

  if (!userId) {
    console.log("[Generations Action] Error: User ID is required");
    throw new Error("User ID is required");
  }

  try {
    const supabase = createAdminClient();
    console.log("[Generations Action] Supabase admin client created");

    // Get user generations from Supabase
    console.log("[Generations Action] Querying generations for user:", userId);
    const { data, error, count } = await supabase
      .from("generations")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[Generations Action] Error fetching generations:", error);
      throw new Error("Failed to fetch generations");
    }

    console.log(
      "[Generations Action] Successfully fetched generations. Count:",
      count
    );

    return {
      generations: data as Generation[],
      count,
      limit,
      offset,
    };
  } catch (error) {
    console.error("[Generations Action] Generations action error:", error);
    throw new Error("Internal Server Error");
  }
}
