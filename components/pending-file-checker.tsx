"use client";

import { useEffect } from "react";
import { useFileViewer } from "@/context/file-viewer-context";
import { toast } from "sonner";

export function PendingFileChecker() {
  const { openFile } = useFileViewer();

  useEffect(() => {
    // Check if there's a pending file to open
    const pendingFileData = sessionStorage.getItem("pendingFile");

    if (pendingFileData) {
      try {
        const { url, type, name } = JSON.parse(pendingFileData);

        // Open the file in the side panel
        openFile(url, type, name);

        // Clear the pending file data
        sessionStorage.removeItem("pendingFile");

        toast.success("Document chargé");
      } catch (error) {
        console.error("Error processing pending file:", error);
        toast.error("Erreur lors de l'ouverture du document");
      }
    }
  }, [openFile]);

  // This component doesn't render anything
  return null;
}
