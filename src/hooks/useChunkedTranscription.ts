import { useState, useRef, useEffect, useCallback } from "react";

export interface ChunkTranscript {
  id: string;
  transcript: string;
  error?: string;
}

interface UseChunkedTranscriptionParams {
  stream: MediaStream | null;
  isActive: boolean;
  authToken: string;
  onTranscriptsUpdate?: (chunks: ChunkTranscript[]) => void;
}

export function useChunkedTranscription({
  stream,
  isActive,
  authToken,
  onTranscriptsUpdate,
}: UseChunkedTranscriptionParams) {
  const [chunks, setChunks] = useState<ChunkTranscript[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkBlobsRef = useRef<Blob[]>([]);
  const isUnmountedRef = useRef(false);

  const resetAll = useCallback(() => {
    setChunks([]);
    setError(null);
    setIsProcessing(false);
    setIsRecording(false);
    chunkBlobsRef.current = [];
  }, []);

  // upload & transcribe logic
  const transcribeAudioChunk = useCallback(
    async (chunkBlob: Blob): Promise<ChunkTranscript> => {
      try {
        const formData = new FormData();
        formData.append("audio", chunkBlob, "audio.webm");
        console.log("using virtual audio");
        const response = await fetch(
          "https://qlfqnclqowlljjcbeunz.supabase.co/functions/v1/transcribe-audio",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
            body: formData,
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          return {
            id: String(Date.now()) + Math.random(),
            transcript: "",
            error: "Transcription failed: " + errText,
          };
        }

        const result = await response.json();
        return {
          id: String(Date.now()) + Math.random(),
          transcript: result.transcript ?? "",
        };
      } catch (err: any) {
        return {
          id: String(Date.now()) + Math.random(),
          transcript: "",
          error: err?.message || "Unknown error in transcription",
        };
      }
    },
    [authToken]
  );

  // Actual chunked recording logic
  useEffect(() => {
    isUnmountedRef.current = false;
    if (!isActive) {
      // Clean up if active state off
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      resetAll();
      return;
    }
    if (!stream) {
      setIsRecording(false);
      setError("No audio stream provided.");
      return;
    }
    setIsRecording(true);

    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = recorder;
    chunkBlobsRef.current = [];
    setIsProcessing(false);
    setError(null);

    // On every 10s chunk
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 1024) {
        (async () => {
          setIsProcessing(true);
          const transcriptObj = await transcribeAudioChunk(e.data);
          if (!isUnmountedRef.current) {
            setChunks((prev) => {
              const updated = [...prev, transcriptObj];
              onTranscriptsUpdate?.(updated);
              return updated;
            });
            setIsProcessing(false);
          }
        })();
      }
    };

    recorder.onerror = (event) => {
      // Fix: Use proper type assertion for MediaRecorderErrorEvent
      const errorMessage =
        // Try extract .error.message; fallback if undefined
        (event as any)?.error?.name ||
        (event as any)?.error?.message ||
        "Unknown recording error";
      setError("Recording error: " + errorMessage);
      setIsRecording(false);
    };

    recorder.onstop = () => {
      setIsRecording(false);
      setIsProcessing(false);
    };

    try {
      recorder.start(10000); // 10s chunk
    } catch (err: any) {
      setError("Unable to start recording: " + err?.message);
      setIsRecording(false);
    }

    return () => {
      isUnmountedRef.current = true;
      try {
        recorder.stop();
      } catch {}
      mediaRecorderRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, stream, transcribeAudioChunk, resetAll]);

  // Manual cleanup
  const stop = useCallback(() => {
    setIsRecording(false);
    setIsProcessing(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }
  }, []);

  return {
    isRecording,
    isProcessing,
    error,
    chunks,
    stop,
    reset: resetAll,
  };
}
