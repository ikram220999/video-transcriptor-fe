"use client";

import { useState, useRef, DragEvent, ChangeEvent, FormEvent } from "react";

type StatusType = "idle" | "loading" | "success" | "error";

interface ProgressStep {
  step: string;
  status: "started" | "processing" | "completed";
  message: string;
  details?: Record<string, unknown>;
}

interface UploadResult {
  success?: boolean;
  message?: string;
  jobId?: string;
  story?: string;
  error?: string;
  summary?: {
    scenesDetected?: number;
    audioSegments?: number;
    keyframesExtracted?: number;
    scenesAnalyzed?: number;
  };
}

const STEP_LABELS: Record<string, string> = {
  upload: "Upload",
  validation: "Validation",
  init: "Initializing",
  scenes: "Scene Detection",
  audio: "Audio Extraction",
  keyframes: "Keyframe Extraction",
  personas: "Personas",
  vision: "AI Vision Analysis",
  story: "Story Generation",
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [personas, setPersonas] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState<StatusType>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB in bytes

  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      setFileError("File size must be under 30MB");
      return false;
    }
    setFileError(null);
    return true;
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith("video/")) {
      if (validateFile(files[0])) {
        setFile(files[0]);
      } else {
        setFile(null);
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      } else {
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return;

    setIsSubmitting(true);
    setStatus("loading");
    setResult(null);
    setProgressSteps([]);
    setCurrentStep("");

    const formData = new FormData();
    formData.append("video", file);
    formData.append("personas", personas);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEventType = "";

      const processLine = (line: string) => {
        if (line.startsWith("event: ")) {
          currentEventType = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const dataStr = line.slice(6);
          try {
            const data = JSON.parse(dataStr);

            if (currentEventType === "progress") {
              setCurrentStep(data.step);
              setProgressSteps((prev) => {
                const existing = prev.findIndex((p) => p.step === data.step);
                if (existing >= 0) {
                  const updated = [...prev];
                  updated[existing] = data;
                  return updated;
                }
                return [...prev, data];
              });
            } else if (currentEventType === "complete") {
              setStatus("success");
              setResult(data);
              setIsSubmitting(false);
            } else if (currentEventType === "error") {
              setStatus("error");
              setResult({ error: data.message });
              setIsSubmitting(false);
            }
          } catch {
            // Ignore parse errors
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Process any remaining data in buffer
          if (buffer.trim()) {
            const remainingLines = buffer.split("\n");
            for (const line of remainingLines) {
              if (line.trim()) {
                processLine(line);
              }
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            processLine(line);
          }
        }
      }
      
      // Ensure we mark as not submitting if stream ended without complete/error event
      setIsSubmitting(false);
    } catch (error) {
      setStatus("error");
      setResult({
        error: error instanceof Error ? error.message : "An error occurred",
      });
      setIsSubmitting(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasActivity = status !== "idle";

  return (
    <main className="main-wrapper">
      <div className="main-container">
        {/* Left Panel - Upload Form */}
        <div className={`left-panel ${hasActivity ? "has-activity" : "centered"}`}>
          {/* Header */}
          <header style={{ marginBottom: "1.5rem" }}>
            <h1
              style={{
                fontSize: "1.25rem",
                fontWeight: 500,
                color: "#f5f5f5",
                letterSpacing: "-0.025em",
              }}
            >
              Video to Story
            </h1>
            <p style={{ color: "#737373", fontSize: "0.875rem", marginTop: "0.25rem" }}>
              Generate narratives from video content
            </p>
          </header>

          <form onSubmit={handleSubmit}>
            {/* Upload Area */}
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  position: "relative",
                  borderRadius: "0.5rem",
                  border: `1px solid ${isDragOver ? "#525252" : file ? "#3f3f46" : "#27272a"}`,
                  background: isDragOver ? "#171717" : file ? "rgba(23,23,23,0.5)" : "transparent",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    padding: "1.5rem",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "120px",
                  }}
                >
                  {file ? (
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          color: "#d4d4d8",
                          fontSize: "0.875rem",
                        }}
                      >
                        <svg
                          style={{ width: "1rem", height: "1rem" }}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                          />
                        </svg>
                        <span
                          style={{
                            display: "inline-block",
                            maxWidth: "200px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {file.name}
                        </span>
                      </div>
                      <p style={{ color: "#52525b", fontSize: "0.75rem", marginTop: "0.375rem" }}>
                        {formatFileSize(file.size)}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearFile();
                        }}
                        style={{
                          fontSize: "0.75rem",
                          color: "#71717a",
                          marginTop: "0.5rem",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center" }}>
                      <svg
                        style={{
                          width: "1.25rem",
                          height: "1.25rem",
                          margin: "0 auto 0.5rem",
                          color: isDragOver ? "#a3a3a3" : "#525252",
                        }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                        />
                      </svg>
                      <p style={{ color: "#a3a3a3", fontSize: "0.875rem" }}>
                        Drop video or <span style={{ color: "#d4d4d8" }}>browse</span>
                      </p>
                      <p style={{ color: "#525252", fontSize: "0.7rem", marginTop: "0.25rem" }}>
                        MP4, MOV, AVI (max 30MB, 1 min)
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              {fileError && (
                <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "0.5rem" }}>{fileError}</p>
              )}
            </div>

            {/* Context Input */}
            <div style={{ marginTop: "1rem" }}>
              <label style={{ display: "block", color: "#a3a3a3", fontSize: "0.75rem", marginBottom: "0.375rem" }}>
                Context <span style={{ color: "#525252" }}>(optional)</span>
              </label>
              <textarea
                value={personas}
                onChange={(e) => setPersonas(e.target.value)}
                placeholder={`Add one or more personas...\nExample:\nTom - a gray cat\nJerry - brown mouse`}
                rows={3}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "1px solid #27272a",
                  borderRadius: "0.5rem",
                  padding: "0.625rem",
                  fontSize: "0.875rem",
                  color: "#e5e5e5",
                  resize: "none",
                  outline: "none",
                  whiteSpace: "pre-line",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3f3f46")}
                onBlur={(e) => (e.target.style.borderColor = "#27272a")}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!file || isSubmitting}
              style={{
                width: "100%",
                marginTop: "1rem",
                padding: "0.625rem",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                border: "none",
                background: !file || isSubmitting ? "#171717" : "#f5f5f5",
                color: !file || isSubmitting ? "#525252" : "#171717",
                cursor: !file || isSubmitting ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              {isSubmitting ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                  <svg
                    style={{ width: "1rem", height: "1rem", animation: "spin 1s linear infinite" }}
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                "Generate"
              )}
            </button>
          </form>
        </div>

        {/* Right Panel - Progress / Results */}
        {hasActivity && (
          <div className="right-panel">
            {/* Progress */}
            {status === "loading" && (
              <div style={{ padding: "1.25rem", height: "100%", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                  <svg
                    style={{ width: "1rem", height: "1rem", color: "#a3a3a3", animation: "spin 1s linear infinite" }}
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span style={{ color: "#a3a3a3", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Processing
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {progressSteps.map((step) => {
                    const isVision = step.step === "vision";
                    const isActive = currentStep === step.step;
                    const details = step.details as { currentScene?: number; totalScenes?: number; sceneNumber?: number } | undefined;
                    const hasProgress = isVision && details && (details.currentScene || details.sceneNumber) && details.totalScenes;
                    const progressPercent = hasProgress
                      ? Math.round(((details.currentScene || details.sceneNumber || 0) / (details.totalScenes || 1)) * 100)
                      : 0;

                    return (
                      <div
                        key={step.step}
                        style={{
                          padding: isVision && isActive ? "0.75rem" : "0.5rem 0.75rem",
                          background: isActive ? "#1a1a1a" : "transparent",
                          borderRadius: "0.5rem",
                          border: isVision && isActive ? "1px solid #27272a" : "1px solid transparent",
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                          {step.status === "completed" ? (
                            <div
                              style={{
                                width: "1.25rem",
                                height: "1.25rem",
                                borderRadius: "9999px",
                                background: "rgba(16, 185, 129, 0.15)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <svg style={{ width: "0.75rem", height: "0.75rem", color: "#10b981" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            </div>
                          ) : step.status === "started" || step.status === "processing" ? (
                            <div
                              style={{
                                width: "1.25rem",
                                height: "1.25rem",
                                borderRadius: "9999px",
                                background: isVision ? "rgba(139, 92, 246, 0.15)" : "rgba(245, 158, 11, 0.15)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <div
                                style={{
                                  width: "0.375rem",
                                  height: "0.375rem",
                                  borderRadius: "9999px",
                                  background: isVision ? "#8b5cf6" : "#f59e0b",
                                  animation: "pulse 1.5s ease-in-out infinite",
                                }}
                              />
                            </div>
                          ) : (
                            <div
                              style={{
                                width: "1.25rem",
                                height: "1.25rem",
                                borderRadius: "9999px",
                                background: "#1f1f1f",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <div style={{ width: "0.25rem", height: "0.25rem", borderRadius: "9999px", background: "#3f3f46" }} />
                            </div>
                          )}
                          <span
                            style={{
                              fontSize: "0.8125rem",
                              color: step.status === "completed" ? "#737373" : isActive ? "#e5e5e5" : "#525252",
                              fontWeight: isActive ? 500 : 400,
                              flex: 1,
                            }}
                          >
                            {STEP_LABELS[step.step] || step.step}
                          </span>
                          {/* Show percentage badge for vision */}
                          {isVision && isActive && hasProgress && (
                            <span
                              style={{
                                fontSize: "0.6875rem",
                                fontWeight: 600,
                                color: "#8b5cf6",
                                background: "rgba(139, 92, 246, 0.15)",
                                padding: "0.125rem 0.5rem",
                                borderRadius: "9999px",
                              }}
                            >
                              {progressPercent}%
                            </span>
                          )}
                          {/* Show checkmark count for completed steps with details */}
                          {step.status === "completed" && step.details && (
                            <span style={{ fontSize: "0.6875rem", color: "#525252" }}>
                              {(step.details as { sceneCount?: number }).sceneCount && `${(step.details as { sceneCount?: number }).sceneCount} scenes`}
                              {(step.details as { keyframeCount?: number }).keyframeCount && `${(step.details as { keyframeCount?: number }).keyframeCount} frames`}
                              {(step.details as { audioCount?: number }).audioCount && `${(step.details as { audioCount?: number }).audioCount} clips`}
                            </span>
                          )}
                        </div>

                        {/* Progress bar for vision analysis */}
                        {isVision && isActive && (step.status === "started" || step.status === "processing") && (
                          <div style={{ marginTop: "0.625rem" }}>
                            {hasProgress ? (
                              <>
                                <div
                                  style={{
                                    height: "0.375rem",
                                    background: "#27272a",
                                    borderRadius: "9999px",
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      height: "100%",
                                      width: `${progressPercent}%`,
                                      background: "linear-gradient(90deg, #8b5cf6, #a78bfa)",
                                      borderRadius: "9999px",
                                      transition: "width 0.3s ease",
                                    }}
                                  />
                                </div>
                                <p style={{ fontSize: "0.6875rem", color: "#737373", marginTop: "0.375rem" }}>
                                  Analyzing scene {details.currentScene || details.sceneNumber} of {details.totalScenes}
                                </p>
                              </>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <div
                                  style={{
                                    flex: 1,
                                    height: "0.375rem",
                                    background: "#27272a",
                                    borderRadius: "9999px",
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      height: "100%",
                                      width: "30%",
                                      background: "linear-gradient(90deg, #8b5cf6, #a78bfa)",
                                      borderRadius: "9999px",
                                      animation: "shimmer 1.5s ease-in-out infinite",
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Success */}
            {status === "success" && result?.story && (
              <div style={{ padding: "1.25rem", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", flexShrink: 0 }}>
                  <svg style={{ width: "1rem", height: "1rem", color: "#10b981" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span style={{ color: "#a3a3a3", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Generated Story
                  </span>
                </div>

                <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
                  <p style={{ color: "#d4d4d4", fontSize: "0.875rem", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {result.story}
                  </p>
                </div>

                {result.summary && (
                  <div style={{ display: "flex", gap: "1.5rem", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #27272a", flexShrink: 0 }}>
                    {result.summary.scenesDetected && (
                      <div>
                        <p style={{ color: "#e5e5e5", fontSize: "1.125rem", fontWeight: 500 }}>{result.summary.scenesDetected}</p>
                        <p style={{ color: "#525252", fontSize: "0.7rem" }}>scenes</p>
                      </div>
                    )}
                    {result.summary.keyframesExtracted && (
                      <div>
                        <p style={{ color: "#e5e5e5", fontSize: "1.125rem", fontWeight: 500 }}>{result.summary.keyframesExtracted}</p>
                        <p style={{ color: "#525252", fontSize: "0.7rem" }}>keyframes</p>
                      </div>
                    )}
                    {result.summary.scenesAnalyzed && (
                      <div>
                        <p style={{ color: "#e5e5e5", fontSize: "1.125rem", fontWeight: 500 }}>{result.summary.scenesAnalyzed}</p>
                        <p style={{ color: "#525252", fontSize: "0.7rem" }}>analyzed</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {status === "error" && result?.error && (
              <div style={{ padding: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <svg style={{ width: "1rem", height: "1rem", color: "#ef4444", marginTop: "0.125rem", flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <div>
                    <p style={{ color: "#d4d4d4", fontSize: "0.875rem" }}>{result.error}</p>
                    <button
                      onClick={() => { setStatus("idle"); setResult(null); setProgressSteps([]); }}
                      style={{ fontSize: "0.75rem", color: "#737373", marginTop: "0.5rem", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
