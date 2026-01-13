import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const video = formData.get("video") as File | null;
    const personas = formData.get("personas") as string;

    if (!video) {
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!video.type.startsWith("video/")) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a video file." },
        { status: 400 }
      );
    }

    // Generate a mock job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Simulate processing (in production, you'd send this to your backend)
    console.log(`Processing video: ${video.name}`);
    console.log(`Personas: ${personas}`);
    console.log(`Job ID: ${jobId}`);

    // Mock response - replace this with actual API call to your backend
    return NextResponse.json({
      message: "Video uploaded successfully!",
      jobId,
      summary: {
        scenesDetected: Math.floor(Math.random() * 10) + 5,
        keyframesExtracted: Math.floor(Math.random() * 50) + 20,
      },
      story: personas
        ? `Based on your personas and the uploaded video "${video.name}", here's a generated story preview...\n\nThis is where the AI-generated story would appear after processing is complete. The story would incorporate the characters and context you provided.`
        : undefined,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}

// Configure the API route to handle large files
export const config = {
  api: {
    bodyParser: false,
  },
};
