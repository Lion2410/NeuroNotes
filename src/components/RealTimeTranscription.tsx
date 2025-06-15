// RealTimeTranscription rewritten for polling HTTP + PCM16 upload (no websockets).
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, Square, Users, Clock, Save, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TranscriptSegment {
  id: string;
  timestamp: string;
  speaker?: string;
  text: string;
  confidence: number;
}

interface RealTimeTranscriptionProps {
  audioStream: MediaStream | null;
  onTranscriptUpdate: (segments: TranscriptSegment[]) => void;
  isActive: boolean;
  onToggle: () => void;
}

// Inline utility: convert Float32 to PCM16 mono little-endian
function floatTo16BitPCM(float32Array: Float32Array): Uint8Array {
  const len = float32Array.length;
  const buf = new Uint8Array(len * 2);
  for (let i = 0; i < len; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7FFF;
    const val = Math.round(s);
    buf[i * 2] = val & 0xff;
    buf[i * 2 + 1] = (val >> 8) & 0xff;
  }
  // Debug: Log first 12 PCM samples
  console.log('[DEBUG] floatTo16BitPCM: first 12 int16 samples =', Array.from(buf.slice(0,24)));
  return buf;
}

const SAMPLERATE_TARGET = 24000;
// Resample from any to 24k mono, logs input vs output buffer
async function resampleTo24KHzMono(audioBuffer: AudioBuffer): Promise<Float32Array> {
  const n = Math.round(audioBuffer.duration * SAMPLERATE_TARGET);
  const ctx = new OfflineAudioContext(1, n, SAMPLERATE_TARGET);
  const src = ctx.createBufferSource();
  let monoBuf = ctx.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
  const inputL = audioBuffer.getChannelData(0);
  let inputR;
  if (audioBuffer.numberOfChannels > 1) inputR = audioBuffer.getChannelData(1);
  const output = monoBuf.getChannelData(0);
  for (let i = 0; i < audioBuffer.length; ++i) {
    output[i] = (inputL[i] + (inputR ? inputR[i] : 0)) / (inputR ? 2 : 1);
  }
  src.buffer = monoBuf;
  src.connect(ctx.destination);
  src.start();

  // Debug: Log first 12 samples pre-resample
  console.log("[DEBUG] resampleTo24KHzMono input (length, samplerate, first 12):", audioBuffer.length, audioBuffer.sampleRate, Array.from(output.slice(0, 12)));

  const rendered = await ctx.startRendering();

  // Debug: Log post-resample
  const channel = rendered.getChannelData(0);
  console.log("[DEBUG] resampleTo24KHzMono output (length, samplerate, first 12):", rendered.length, rendered.sampleRate, Array.from(channel.slice(0, 12)));

  return channel.slice();
}

const RealTimeTranscription: React.FC<RealTimeTranscriptionProps> = ({
  audioStream,
  onTranscriptUpdate,
  isActive,
  onToggle
}) => {
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isUserConnecting, setIsUserConnecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chunkBuffersRef = useRef<Float32Array[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<Date | null>(null);

  const { toast } = useToast();

  // Debug state for UI
  const [lastUploadDebug, setLastUploadDebug] = useState<{
    mode: string, sessionId: string|null, deviceLabel: string, chunkLen: number, pcmLen: number, timestamp: string
  }|null>(null);

  // Timer
  useEffect(() => {
    if (isActive) {
      sessionStartRef.current = new Date();
      intervalRef.current = setInterval(() => {
        if (sessionStartRef.current) {
          const duration = Math.floor((Date.now() - sessionStartRef.current.getTime()) / 1000);
          setSessionDuration(duration);
        }
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive]);

  // Start/stop audio capture+push on isActive
  useEffect(() => {
    if (!isActive) {
      cleanupRecording();
      setSessionId(null);
      setIsUploading(false);
      setIsUserConnecting(false);
      setLastError(null);
      return;
    }
    if (!audioStream) {
      setLastError("No virtual audio input selected!");
      toast({
        title: "No Audio",
        description: "Please select a virtual audio device first.",
        variant: "destructive",
      });
      onToggle();
      return;
    }
    setIsUserConnecting(true);

    startRecording();
    // Cleanup when toggled off
    return () => {
      cleanupRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, audioStream]);

  // Polling upload chunk audio every 3 seconds
  const startRecording = () => {
    if (!audioStream) return;

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const src = audioCtx.createMediaStreamSource(audioStream);
      mediaStreamSourceRef.current = src;

      const processor = audioCtx.createScriptProcessor(4096, src.channelCount, 1);
      processorRef.current = processor;
      chunkBuffersRef.current = [];

      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        // Downmix and collect every callback (multiple times/second)
        const ch = inputBuffer.numberOfChannels > 1 ? inputBuffer : undefined;
        const frame = ch
          ? new Float32Array(inputBuffer.length)
          : inputBuffer.getChannelData(0).slice();
        if (ch) {
          for (let i = 0; i < inputBuffer.length; i++) {
            let sum = 0;
            for (let c = 0; c < inputBuffer.numberOfChannels; c++) {
              sum += inputBuffer.getChannelData(c)[i];
            }
            frame[i] = sum / inputBuffer.numberOfChannels;
          }
        }
        chunkBuffersRef.current.push(frame);

        // Debug live waveform stats for the latest frame
        if (frame.length > 0) {
          const min = Math.min(...frame);
          const max = Math.max(...frame);
          const avg = frame.reduce((a,b)=>a+b,0)/frame.length;
          console.log(`[AUDIO_DEBUG] Added audio frame: len=${frame.length} min=${min.toFixed(2)} max=${max.toFixed(2)} avg=${avg.toFixed(2)}`);
        }
      };

      src.connect(processor);
      processor.connect(audioCtx.destination);

      pollingTimeoutRef.current = setInterval(postChunk, 3000);

      setIsUserConnecting(false);
      toast({
        title: 'Transcription Started',
        description: 'Capturing meeting audio for transcription...',
      });
    } catch (err: any) {
      setLastError("Could not start audio capture: " + err?.message);
      setIsUserConnecting(false);
      toast({
        title: 'Capture Start Failed',
        description: err?.message || "Failed to start capture",
        variant: "destructive",
      });
      onToggle();
    }
  };

  const postChunk = async () => {
    if (!chunkBuffersRef.current.length) return;
    setIsUploading(true);

    try {
      // concat all samples for current chunk
      const totalLen = chunkBuffersRef.current.reduce((a, b) => a + b.length, 0);
      const samples = new Float32Array(totalLen);
      let pos = 0;
      for (const arr of chunkBuffersRef.current) {
        samples.set(arr, pos);
        pos += arr.length;
      }
      chunkBuffersRef.current = [];

      // Log: print min/max/avg and first 20 of the combined sample buffer
      if (samples.length > 0) {
        const min = Math.min(...samples);
        const max = Math.max(...samples);
        const avg = samples.reduce((a,b)=>a+b,0)/samples.length;
        console.log(`[AUDIO_DEBUG] [CHUNK] Combined samples: length=${samples.length} min=${min.toFixed(2)} max=${max.toFixed(2)} avg=${avg.toFixed(2)} first20=`, Array.from(samples.slice(0,20)));
      }

      // Resample to 24k mono
      const audioCtx = audioCtxRef.current;
      if (!audioCtx) throw new Error("No audio context available");
      const inputBuffer = audioCtx.createBuffer(
        1, samples.length, audioCtx.sampleRate
      );
      inputBuffer.copyToChannel(samples, 0);
      const mono24kFloat32 = await resampleTo24KHzMono(inputBuffer);

      // Log: resampled data min/max, length
      if (mono24kFloat32.length > 0) {
        const min = Math.min(...mono24kFloat32);
        const max = Math.max(...mono24kFloat32);
        const avg = mono24kFloat32.reduce((a,b)=>a+b,0)/mono24kFloat32.length;
        console.log(`[AUDIO_DEBUG] [CHUNK] Resampled (24kHz, mono): length=${mono24kFloat32.length} min=${min.toFixed(2)} max=${max.toFixed(2)} avg=${avg.toFixed(2)} first20=`, Array.from(mono24kFloat32.slice(0,20)));
      }

      // PCM16 encoding
      const pcmBuf = floatTo16BitPCM(mono24kFloat32);

      // Log: show PCM buffer length, first 32 bytes
      console.log(`[DEBUG_UPLOAD] PCM16 Buffer: bytes=${pcmBuf.length}`);

      // Compose formData with explicit logs before each append
      const formData = new FormData();

      // Compose values for debug tracking before appending to formData
      const debugPayload = {
        mode: "virtualaudio",
        sessionId,
        deviceLabel: "virtualaudio",
        chunkLen: samples.length,
        pcmLen: pcmBuf.length,
        timestamp: new Date().toLocaleTimeString()
      };

      // LOG before formData mutation
      console.log("[DEBUG_UPLOAD] Will append fields to FormData:", {
        mode: debugPayload.mode,
        deviceLabel: debugPayload.deviceLabel,
        sessionId: debugPayload.sessionId,
        pcmBytes: debugPayload.pcmLen,
        chunkSamples: debugPayload.chunkLen,
        timestamp: debugPayload.timestamp
      });

      // append audio chunk
      const blob = new Blob([pcmBuf], { type: 'audio/raw' });
      console.log("[DEBUG_UPLOAD] FormData.append('audio', Blob, 'audio.pcm')", blob.size, blob.type);
      formData.append("audio", blob, "audio.pcm");

      // append fields
      console.log("[DEBUG_UPLOAD] FormData.append('mode', 'virtualaudio')");
      formData.append("mode", "virtualaudio");

      if (sessionId) {
        console.log(`[DEBUG_UPLOAD] FormData.append('sessionId', '${sessionId}')`);
        formData.append("sessionId", sessionId);
      }

      console.log("[DEBUG_UPLOAD] FormData.append('deviceLabel', 'virtualaudio')");
      formData.append("deviceLabel", "virtualaudio");

      // Save latest debug info for UI
      setLastUploadDebug(debugPayload);

      // POST: submit chunk
      const response = await fetch("https://qlfqnclqowlljjcbeunz.supabase.co/functions/v1/transcribe-audio", {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${window.sessionStorage.getItem('supabase.auth.token') || ''}`
        },
        body: formData
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        console.error("[TRANSCRIBE ERROR] Post failed, error=", result.error, "resp_status", response.status);
        // Detect known Deepgram "unsupported/corrupt" error and help user
        if (result.error && result.error.includes("corrupt or unsupported data")) {
          setLastError("Deepgram rejected PCM audio as corrupt or unsupported. Try a different virtual audio source, restart browser, or play a sample audio using the system default playback device. If using headphones, unplug and select a virtual cable as your input.");
          toast({
            title: "Audio Format Error",
            description: "Deepgram returned: corrupt or unsupported data. Try a different source or a demo virtual device with known good audio.",
            variant: "destructive",
          });
        } else {
          throw new Error(result.error || "Unknown error from backend");
        }
        setIsUploading(false);
        return;
      }
      // Parse new transcript, sessionId, speakerSegments
      setSessionId(result.sessionId);
      if (result.speakerSegments && Array.isArray(result.speakerSegments)) {
        const newSegments: TranscriptSegment[] = result.speakerSegments.map((segment: any, i: number) => ({
          id: Date.now().toString() + Math.random() + i,
          timestamp: new Date().toLocaleTimeString(),
          speaker: segment.speaker,
          text: segment.text,
          confidence: segment.confidence ?? 1
        }));
        setTranscriptSegments((prev) => {
          const merged = [...prev, ...newSegments];
          onTranscriptUpdate(merged);
          return merged;
        });
      } else if (result.transcript) {
        setTranscriptSegments((prev) => {
          const newSeg: TranscriptSegment = {
            id: Date.now().toString() + Math.random(),
            timestamp: new Date().toLocaleTimeString(),
            speaker: "Speaker",
            text: result.transcript,
            confidence: 1
          };
          const merged = [...prev, newSeg];
          onTranscriptUpdate(merged);
          return merged;
        });
      }
      setIsUploading(false);
    } catch (err: any) {
      setLastError("Error uploading audio: " + err?.message);
      toast({
        title: "Transcription Error",
        description: err?.message || "Failed to get transcript back from backend.",
        variant: "destructive",
      });
      setIsUploading(false);
    }
  };

  const cleanupRecording = () => {
    // Disconnect proc/audio
    if (pollingTimeoutRef.current) clearInterval(pollingTimeoutRef.current);
    pollingTimeoutRef.current = null;
    chunkBuffersRef.current = [];
    try {
      processorRef.current?.disconnect();
      mediaStreamSourceRef.current?.disconnect();
      audioCtxRef.current?.close();
    } catch { }
    processorRef.current = null;
    audioCtxRef.current = null;
    mediaStreamSourceRef.current = null;
  };

  const handleManualRetry = () => {
    setLastError(null);
    setIsUserConnecting(false);
    startRecording();
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const exportTranscript = () => {
    const transcript = transcriptSegments
      .map(segment => `[${segment.timestamp}] ${segment.speaker}: ${segment.text}`)
      .join('\n');
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-transcript-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Mic className="h-5 w-5 text-purple-400" />
            Real-Time Transcription
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={
              isActive
                ? (isUploading ? 'secondary' : 'secondary')
                : lastError ? "destructive"
                  : "secondary"
            }>
              {
                isUserConnecting ? "Connecting..."
                  : isActive ? (isUploading ? "Uploading..." : "Active")
                    : lastError ? "Error"
                      : "Ready"
              }
            </Badge>
            {lastError && (
              <Button
                onClick={handleManualRetry}
                variant="secondary"
                size="icon"
                className="bg-yellow-600 hover:bg-yellow-700"
                title="Retry Now"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            <Button
              onClick={onToggle}
              variant={isActive ? "destructive" : "default"}
              size="sm"
              className={isActive ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
              disabled={isUserConnecting}
            >
              {isActive ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Start
                </>
              )}
            </Button>
          </div>
        </div>
        {isActive && (
          <div className="flex items-center gap-4 text-sm text-slate-300">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(sessionDuration)}
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {new Set(transcriptSegments.map(s => s.speaker)).size} speakers
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* --- NEW DEBUG PANEL --- */}
        <div className="mb-2 max-w-full">
          <div className="rounded bg-slate-900/70 p-2 text-xs text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1 overflow-x-auto">
            <span className="font-semibold text-purple-300">UPLOAD DEBUG</span>
            <span>mode: <span className="font-mono text-white">{lastUploadDebug?.mode || 'n/a'}</span></span>
            <span>sessionId: <span className="font-mono text-white">{lastUploadDebug?.sessionId || 'n/a'}</span></span>
            <span>deviceLabel: <span className="font-mono text-white">{lastUploadDebug?.deviceLabel || 'n/a'}</span></span>
            <span>PCM bytes: <span className="font-mono">{lastUploadDebug?.pcmLen ?? '--'}</span></span>
            <span>Chunk samples: <span className="font-mono">{lastUploadDebug?.chunkLen ?? '--'}</span></span>
            <span>Time: <span className="font-mono">{lastUploadDebug?.timestamp ?? '--'}</span></span>
          </div>
        </div>
        {/* --- END DEBUG PANEL --- */}

        {lastError &&
          <div className="mb-2 bg-red-900/30 border border-red-400 text-white p-3 rounded flex items-center justify-between">
            <span className="truncate">{lastError}</span>
            <Button
              onClick={() => setLastError(null)}
              variant="outline"
              size="sm"
              className="ml-3 text-white border-red-400 hover:bg-red-400/10"
            >Dismiss</Button>
          </div>
        }
        <ScrollArea className="h-96 w-full">
          <div className="space-y-3">
            {transcriptSegments.length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                {isUserConnecting ? "Connecting…" : isActive ? "Listening for audio..." : "Start transcription to see live results"}
              </div>
            ) : (
              transcriptSegments.map(segment => (
                <div key={segment.id} className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {segment.speaker}
                      </Badge>
                      <span className="text-xs text-slate-400">{segment.timestamp}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(segment.confidence * 100)}%
                    </Badge>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{segment.text}</p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        {transcriptSegments.length > 0 && (
          <div className="mt-4 flex gap-2">
            <Button
              onClick={exportTranscript}
              variant="outline"
              size="sm"
              className="border-white/30 hover:bg-white/10 text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              Export Transcript
            </Button>
            <Button
              onClick={() => setTranscriptSegments([])}
              variant="outline"
              size="sm"
              className="border-white/30 hover:bg-white/10 text-white"
            >
              Clear
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RealTimeTranscription;

// This file is now very long (>350 lines).
// Consider refactoring into smaller hooks/components for maintainability!
