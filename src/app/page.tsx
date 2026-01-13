"use client";

import { useState, useRef, DragEvent, ChangeEvent, FormEvent } from "react";

type StatusType = "idle" | "loading" | "success" | "error";

interface UploadResult {
  message?: string;
  jobId?: string;
  story?: string;
  error?: string;
  summary?: {
    scenesDetected?: number;
    keyframesExtracted?: number;
  };
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [personas, setPersonas] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState<StatusType>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith("video/")) {
      setFile(files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return;

    setIsSubmitting(true);
    setStatus("loading");
    setResult(null);

    const formData = new FormData();
    formData.append("video", file);
    formData.append("personas", personas);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data: UploadResult = await response.json();

      if (response.ok) {
        setStatus("success");
        setResult(data);
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (error) {
      setStatus("error");
      setResult({
        error: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-white mb-1">
            Video Story Generator
          </h1>
          <p className="text-sm text-[#737373]">
            Upload a video to generate AI stories
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-8 shadow-lg">
          <form onSubmit={handleSubmit}>
            {/* Upload */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-[#737373] mb-3 uppercase tracking-wide">
                Video
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  border border-dashed rounded-xl py-10 px-6 text-center cursor-pointer transition-all
                  ${isDragOver
                    ? "border-[#7c3aed] bg-[#7c3aed]/10"
                    : file
                      ? "border-[#22c55e] bg-[#22c55e]/5"
                      : "border-[#333] hover:border-[#444] bg-[#0a0a0a]"
                  }
                `}
              >
                {file ? (
                  <div className="text-[#22c55e] text-sm">✓ {file.name}</div>
                ) : (
                  <div className="text-[#666] text-sm">
                    Drop video or <span className="text-[#7c3aed]">browse</span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Personas */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-[#737373] mb-3 uppercase tracking-wide">
                Context (optional)
              </label>
              <textarea
                value={personas}
                onChange={(e) => setPersonas(e.target.value)}
                placeholder="Describe characters or context..."
                rows={4}
                className="
                  w-full bg-[#0a0a0a] border border-[#333] rounded-xl p-4
                  text-sm text-white placeholder-[#444] resize-none
                  focus:outline-none focus:border-[#444] transition-colors
                "
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!file || isSubmitting}
              className="
                w-full py-4 bg-[#7c3aed] rounded-xl text-sm font-medium text-white
                hover:bg-[#6d28d9] transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
              "
            >
              {isSubmitting ? "Processing..." : "Generate"}
            </button>

            {/* Status */}
            {status === "loading" && (
              <div className="mt-6 p-4 rounded-xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 text-[#a78bfa] text-sm text-center animate-pulse-slow">
                Processing video...
              </div>
            )}

            {status === "success" && result && (
              <div className="mt-6 p-4 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#4ade80] text-sm">
                <div className="font-medium">✓ {result.message}</div>
                {result.story && (
                  <p className="mt-3 text-[#888] whitespace-pre-wrap">{result.story}</p>
                )}
              </div>
            )}

            {status === "error" && result && (
              <div className="mt-6 p-4 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#f87171] text-sm text-center">
                {result.error}
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
