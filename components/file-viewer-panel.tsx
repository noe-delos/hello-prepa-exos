/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { useFileViewer } from "@/context/file-viewer-context";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Worker, Viewer, SpecialZoomLevel } from "@react-pdf-viewer/core";
import "@react-pdf-viewer/core/lib/styles/index.css";
import { toolbarPlugin } from "@react-pdf-viewer/toolbar";
import "@react-pdf-viewer/toolbar/lib/styles/index.css";
import { pageNavigationPlugin } from "@react-pdf-viewer/page-navigation";
import "@react-pdf-viewer/page-navigation/lib/styles/index.css";

export function FileViewerPanel() {
  const { isOpen, fileUrl, fileType, fileName, closeFile } = useFileViewer();

  // Plugins
  const toolbarPluginInstance = toolbarPlugin();
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { Toolbar } = toolbarPluginInstance;

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeFile();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeFile]);

  // Add or remove a class to the main content when panel is opened/closed
  useEffect(() => {
    const mainContent = document.getElementById("main-content");
    if (mainContent) {
      if (isOpen) {
        mainContent.classList.add("panel-open");
      } else {
        mainContent.classList.remove("panel-open");
      }
    }

    // Add a style tag for the panel-open class if it doesn't exist
    if (!document.getElementById("panel-style")) {
      const style = document.createElement("style");
      style.id = "panel-style";
      style.innerHTML = `
        .panel-open {
          width: calc(100% - 550px) !important;
          transition: width 0.3s ease-in-out;
        }
        @media (max-width: 1024px) {
          .panel-open {
            width: 100% !important;
          }
        }
      `;
      document.head.appendChild(style);
    }

    return () => {
      if (mainContent) {
        mainContent.classList.remove("panel-open");
      }
    };
  }, [isOpen]);

  // Handle direct download
  const handleDownload = () => {
    if (fileUrl) {
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = fileName || "document";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && fileUrl && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed top-0 right-0 h-screen w-[550px] bg-white dark:bg-slate-900 shadow-xl z-50 flex flex-col border-l border-slate-200 dark:border-slate-800"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-semibold truncate max-w-[60%]">
              {fileName}
            </h2>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="flex items-center gap-1 h-8 px-3"
              >
                <Download className="h-3 w-3 mr-1" />
                <span className="text-xs">Télécharger</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeFile}
                aria-label="Close panel"
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {fileUrl &&
              (fileType === "pdf" ? (
                // PDF Viewer
                <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                  <div className="h-full flex flex-col">
                    <div className="p-1 border-b border-slate-200 dark:border-slate-800">
                      <Toolbar>{renderToolbar}</Toolbar>
                    </div>
                    <div className="flex-1 overflow-auto">
                      <Viewer
                        fileUrl={fileUrl}
                        plugins={[
                          toolbarPluginInstance,
                          pageNavigationPluginInstance,
                        ]}
                        defaultScale={SpecialZoomLevel.PageWidth}
                      />
                    </div>
                  </div>
                </Worker>
              ) : (
                // DOCX or other file viewer (fallback to iframe for now)
                <div className="h-full flex flex-col">
                  <div className="flex-1 overflow-auto">
                    <iframe
                      src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                        fileUrl
                      )}`}
                      className="w-full h-full border-0"
                      title={fileName || "Document"}
                    />
                  </div>
                </div>
              ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Custom toolbar renderer with more compact layout
const renderToolbar = (Toolbar: any) => {
  const {
    CurrentPageInput,
    ZoomIn,
    ZoomOut,
    GoToNextPage,
    GoToPreviousPage,
    NumberOfPages,
  } = Toolbar;

  return (
    <div className="flex items-center justify-between px-1 py-1 text-sm">
      <div className="flex items-center gap-1">
        <ZoomOut>
          {(props: any) => (
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onClick}
              className="h-7 w-7 p-0"
            >
              <Icon icon="mdi:magnify-minus" className="h-4 w-4" />
            </Button>
          )}
        </ZoomOut>
        <ZoomIn>
          {(props: any) => (
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onClick}
              className="h-7 w-7 p-0"
            >
              <Icon icon="mdi:magnify-plus" className="h-4 w-4" />
            </Button>
          )}
        </ZoomIn>
      </div>

      <div className="flex items-center gap-1">
        <GoToPreviousPage>
          {(props: any) => (
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onClick}
              className="h-7 w-7 p-0"
            >
              <Icon icon="mdi:chevron-left" className="h-4 w-4" />
            </Button>
          )}
        </GoToPreviousPage>

        <div className="flex items-center text-xs">
          <div className="w-8">
            <CurrentPageInput />
          </div>
          <span className="mx-1">sur</span>
          <NumberOfPages />
        </div>

        <GoToNextPage>
          {(props: any) => (
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onClick}
              className="h-7 w-7 p-0"
            >
              <Icon icon="mdi:chevron-right" className="h-4 w-4" />
            </Button>
          )}
        </GoToNextPage>
      </div>
    </div>
  );
};
