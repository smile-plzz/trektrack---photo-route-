
import { TrekPhoto } from "../types";

export const generateTrekStory = async (photos: TrekPhoto[]) => {
  try {
    const response = await fetch("/api/trek-narrative", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ photos }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to generate narrative");
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("Narrative Error:", error);
    throw error;
  }
};
