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
  const [combinedTranscript, setCombinedTranscript] = useState<string>("");
  const [finalTranscript, setFinalTranscript] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkBlobsRef = useRef<Blob[]>([]);
  const initializationBlobRef = useRef<Blob | null>(null);
  const firstChunkTranscriptRef = useRef<string>("");
  const isUnmountedRef = useRef(false);

  const resetAll = useCallback(() => {
    setChunks([]);
    setCombinedTranscript("");
    setFinalTranscript("");
    setError(null);
    setIsProcessing(false);
    setIsRecording(false);
    chunkBlobsRef.current = [];
    initializationBlobRef.current = null;
    firstChunkTranscriptRef.current = "";
  }, []);

  // Check for sufficient audio energy
  async function hasSufficientAudioEnergy(blob: Blob, isLastChunk: boolean = false): Promise<{ hasEnergy: boolean; energy: number; sampleRate?: number; channels?: number }> {
    if (isLastChunk) {
      console.log("[useChunkedTranscription] Skipping energy check for last chunk");
      return { hasEnergy: true, energy: 0, sampleRate: undefined, channels: undefined };
    }
    try {
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const samples = audioBuffer.getChannelData(0); // Mono
      const energy = samples.reduce((sum, sample) => sum + Math.abs(sample), 0) / samples.length;
      console.log("[useChunkedTranscription] Chunk energy:", energy, "Sample rate:", audioBuffer.sampleRate, "Channels:", audioBuffer.numberOfChannels);
      return { hasEnergy: energy > 0.002, energy, sampleRate: audioBuffer.sampleRate, channels: audioBuffer.numberOfChannels };
    } catch (err) {
      console.error("[useChunkedTranscription] Energy check error:", err);
      return { hasEnergy: true, energy: 0 }; // Proceed if energy check fails
    }
  }

  // Remove first chunk's transcript text with fuzzy matching
  function removeFirstChunkTranscript(current: string, firstTranscript: string): string {
    if (!firstTranscript) {
      console.log("[useChunkedTranscription] No first chunk transcript, returning original:", current);
      return current;
    }
    // Normalize transcripts for comparison (remove punctuation, lowercase)
    const normalize = (str: string) => str.replace(/[.,!?]/g, '').toLowerCase().trim();
    const normalizedFirst = normalize(firstTranscript);
    const normalizedCurrent = normalize(current);
    if (!normalizedCurrent.startsWith(normalizedFirst)) {
      console.log("[useChunkedTranscription] No first chunk transcript match, original:", current, "first:", firstTranscript);
      return current;
    }
    // Find the end index of the first transcript in the original string
    const endIndex = firstTranscript.length;
    const remaining = current.slice(endIndex).trim();
    console.log("[useChunkedTranscription] Removed first chunk transcript, remaining:", remaining);
    return remaining;
  }

  // Upload & transcribe logic
  const transcribeAudioChunk = useCallback(
    async (chunkBlob: Blob, isFirstChunk: boolean, chunkIndex: number, isLastChunk: boolean = false): Promise<ChunkTranscript> => {
      try {
        // Concatenate with initialization chunk for subsequent chunks
        let audioBlob = chunkBlob;
        if (!isFirstChunk && initializationBlobRef.current) {
          audioBlob = new Blob([initializationBlobRef.current, chunkBlob], { type: "audio/webm;codecs=opus" });
          console.log("[useChunkedTranscription] Concatenated WebM chunk, size:", audioBlob.size, "Chunk index:", chunkIndex);
        }

        // Check audio energy on concatenated blob
        const { hasEnergy, energy, sampleRate, channels } = await hasSufficientAudioEnergy(audioBlob, isLastChunk);
        if (!hasEnergy) {
          console.log("[useChunkedTranscription] Skipping chunk due to low audio energy:", energy, "Chunk index:", chunkIndex, "Size:", audioBlob.size);
          return {
            id: String(Date.now()) + Math.random(),
            transcript: "",
            error: "Low audio energy detected",
          };
        }

        // Log concatenated chunk URL for debugging
        const audioBlobUrl = URL.createObjectURL(audioBlob);
        console.log("[useChunkedTranscription] Concatenated chunk URL:", audioBlobUrl);

        const formData = new FormData();
        formData.append("audio", audioBlob, "audio.webm");
        console.log("[useChunkedTranscription] Sending chunk, size:", audioBlob.size, "Sample rate:", sampleRate, "Channels:", channels, "Chunk index:", chunkIndex);
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
          console.error("[useChunkedTranscription] Transcription failed:", response.status, errText, "Chunk index:", chunkIndex);
          return {
            id: String(Date.now()) + Math.random(),
            transcript: "",
            error: `Transcription failed: ${response.status} ${errText}`,
          };
        }

        const result = await response.json();
        console.log("[useChunkedTranscription] Transcription result:", result, "Word count:", result.words?.length || 0, "Chunk index:", chunkIndex);

        // Store first chunk's transcript
        if (isFirstChunk) {
          firstChunkTranscriptRef.current = result.transcript || "";
        }

        // Remove first chunk's transcript for subsequent chunks
        const newTranscript = isFirstChunk ? result.transcript : removeFirstChunkTranscript(result.transcript, firstChunkTranscriptRef.current);

        if (!newTranscript) {
          console.log("[useChunkedTranscription] Empty transcript after processing, Chunk index:", chunkIndex, "Original:", result.transcript);
        }

        return {
          id: String(Date.now()) + Math.random(),
          transcript: newTranscript ?? "",
        };
      } catch (err: any) {
        console.error("[useChunkedTranscription] Transcription error:", err, "Chunk index:", chunkIndex);
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

    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    mediaRecorderRef.current = recorder;
    chunkBlobsRef.current = [];
    setIsProcessing(false);
    setError(null);

    // Monitor stream and track state
    const tracks = stream.getTracks();
    tracks.forEach(track => {
      track.onended = () => {
        console.log("[useChunkedTranscription] Audio track ended:", track.id);
        setError("Audio track ended unexpectedly");
        setIsRecording(false);
      };
    });

    // Periodically log stream state
    const interval = setInterval(() => {
      console.log("[useChunkedTranscription] Stream active:", stream.active, "Track states:", 
        tracks.map(t => ({ id: t.id, readyState: t.readyState, enabled: t.enabled })));
    }, 5000);

    // On every 10s chunk
    let chunkCount = 0;
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 512) {
        console.log("[useChunkedTranscription] Chunk received, size:", e.data.size, "Chunk index:", chunkCount);
        const url = URL.createObjectURL(e.data);
        console.log("[useChunkedTranscription] Chunk URL:", url);
        chunkBlobsRef.current.push(e.data);
        if (chunkCount === 0) {
          initializationBlobRef.current = e.data;
          console.log("[useChunkedTranscription] Stored initialization chunk, size:", e.data.size);
        }
        (async () => {
          setIsProcessing(true);
          const transcriptObj = await transcribeAudioChunk(e.data, chunkCount === 0, chunkCount);
          if (!isUnmountedRef.current) {
            setChunks((prev) => {
              const updated = [...prev, transcriptObj];
              // Update combinedTranscript
              const newCombined = updated
                .filter(c => c.transcript && !c.error)
                .map(c => c.transcript)
                .join(" ");
              setCombinedTranscript(newCombined);
              onTranscriptsUpdate?.(updated);
              return updated;
            });
            setIsProcessing(false);
          }
          chunkCount++;
        })();
      } else {
        console.log("[useChunkedTranscription] Empty or invalid chunk, size:", e.data?.size, "Chunk index:", chunkCount);
      }
    };

    recorder.onerror = (event) => {
      const errorMessage =
        (event as any)?.error?.name ||
        (event as any)?.error?.message ||
        "Unknown recording error";
      setError("Recording error: " + errorMessage);
      setIsRecording(false);
    };

    recorder.onstop = () => {
      setIsRecording(false);
      setIsProcessing(false);
      // Process any remaining chunk
      const lastChunk = chunkBlobsRef.current[chunkBlobsRef.current.length - 1];
      if (lastChunk && lastChunk.size > 512) {
        (async () => {
          setIsProcessing(true);
          const transcriptObj = await transcribeAudioChunk(lastChunk, chunkCount === 0, chunkCount, true);
          if (!isUnmountedRef.current) {
            setChunks((prev) => {
              const updated = [...prev, transcriptObj];
              // Update combinedTranscript and finalTranscript
              const newCombined = updated
                .filter(c => c.transcript && !c.error)
                .map(c => c.transcript)
                .join(" ");
              setCombinedTranscript(newCombined);
              setFinalTranscript(newCombined);
              onTranscriptsUpdate?.(updated);
              return updated;
            });
            setIsProcessing(false);
          }
        })();
      } else {
        // Set finalTranscript even if no last chunk
        const final = chunks
          .filter(c => c.transcript && !c.error)
          .map(c => c.transcript)
          .join(" ");
        setFinalTranscript(final);
      }
    };

    try {
      recorder.start(10000); // 10s chunk
    } catch (err: any) {
      setError("Unable to start recording: " + err?.message);
      setIsRecording(false);
    }

    return () => {
      isUnmountedRef.current = true;
      clearInterval(interval);
      try {
        recorder.stop();
      } catch {}
      mediaRecorderRef.current = null;
    };
  }, [isActive, stream, transcribeAudioChunk, resetAll]);

  // Manual cleanup with promise
  const stop = useCallback(() => {
    return new Promise<string>((resolve) => {
      setIsRecording(false);
      setIsProcessing(false);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
        mediaRecorderRef.current = null;
      }
      // Wait for onstop to complete
      const checkFinalTranscript = () => {
        if (!isProcessing) {
          const final = chunks
            .filter(c => c.transcript && !c.error)
            .map(c => c.transcript)
            .join(" ");
          setFinalTranscript(final);
          resolve(final);
        } else {
          setTimeout(checkFinalTranscript, 100);
        }
      };
      checkFinalTranscript();
    });
  }, [chunks, isProcessing]);

  return {
    isRecording,
    isProcessing,
    error,
    chunks,
    combinedTranscript,
    finalTranscript,
    stop,
    reset: resetAll,
  };
}