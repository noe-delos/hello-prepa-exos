"use client";

import React, { createContext, useContext, useState } from "react";

type FileViewerContextType = {
  isOpen: boolean;
  fileUrl: string | null;
  fileType: string | null;
  fileName: string | null;
  openFile: (url: string, type: string, name: string) => void;
  closeFile: () => void;
};

const FileViewerContext = createContext<FileViewerContextType | null>(null);

export function FileViewerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const openFile = (url: string, type: string, name: string) => {
    setFileUrl(url);
    setFileType(type);
    setFileName(name);
    setIsOpen(true);
  };

  const closeFile = () => {
    setIsOpen(false);
    // Don't immediately clear the file data to allow for smooth exit animations
    setTimeout(() => {
      setFileUrl(null);
      setFileType(null);
      setFileName(null);
    }, 300);
  };

  return (
    <FileViewerContext.Provider
      value={{ isOpen, fileUrl, fileType, fileName, openFile, closeFile }}
    >
      {children}
    </FileViewerContext.Provider>
  );
}

export function useFileViewer() {
  const context = useContext(FileViewerContext);
  if (!context) {
    throw new Error("useFileViewer must be used within a FileViewerProvider");
  }
  return context;
}
