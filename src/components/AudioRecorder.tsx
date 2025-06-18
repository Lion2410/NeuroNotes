import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import AudioWaveformVisualizer from "./AudioWaveformVisualizer";

interface SpeakerSegment {
  speaker: string;
  text: string;
  confidence: number;
}

interface AudioRecorderProps {
  onTranscription: (text: string) => void;
  onFinalized: (fullTranscript: string, speakerSegments: SpeakerSegment[]) => void;
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
}

const supabaseTranscribeURL = 'https://qlfqnclqowlljjcbeunz.supabase.co/functions/v1/transcribe-audio';
const CHUNK_SECONDS = 10;
const PCM_SAMPLE_RATE = 24000;

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onTranscription,
  onFinalized,
  isRecording,
  setIsRecording,
}) => {
  const { user, session } = useAuth();
  const { toast } = useToast();

  const [transcript, setTranscript] = useState('');
  const [segments, setSegments] = useState<SpeakerSegment[]>([]);
  const [processing, setProcessing] = useState(false);
  const [recordingStart, setRecordingStart] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Refs for everything requiring persistence
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const recBuffersRef = useRef<Float32Array[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const fullSpeakerSegmentsRef = useRef<SpeakerSegment[]>([]);
  const [lastRecordedChunk, setLastRecordedChunk] = useState<Float32Array | null>(null);
  const [lastChunkStats, setLastChunkStats] = useState<{
    peak: number;
    rms: number;
    zeros: number;
    length: number;
    example: number[];
  } | null>(null);

  // Stop logic
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setProcessing(false);

    // Stop all nodes and tracks
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current.onaudioprocess = null; }
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(tr => tr.stop()); streamRef.current = null; }

    // Timers off
    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setElapsedSeconds(0);
    setRecordingStart(null);

    // Finalize transcript
    const transcriptText = fullSpeakerSegmentsRef.current.map(seg => `[${seg.speaker}]: ${seg.text}`).join('\n');
    onFinalized(transcriptText, [...fullSpeakerSegmentsRef.current]);
    toast({ title: "Recording Stopped", description: "Transcription finalized and ready." });
  }, [onFinalized, isRecording]);

  // Start logic
  const startRecording = useCallback(async () => {
    setTranscript('');
    setSegments([]);
    setProcessing(false);
    fullSpeakerSegmentsRef.current = [];
    sessionIdRef.current = null;

    try {
      // Always use system default microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: PCM_SAMPLE_RATE } });
      streamRef.current = stream;
      // Always force new AudioContext for sample rate
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: PCM_SAMPLE_RATE });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(audioContext.destination);

      recBuffersRef.current = [];
      timerRef.current = window.setInterval(() => handleChunk(audioContext.sampleRate), CHUNK_SECONDS * 1000);

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        // If all zeros, warn; for debugging actual silence!
        const zeroed = input.every(v => v === 0);
        if (zeroed) {
          console.warn('[WARN] Recording buffer is all zero! Microphone muted or browser permission bug?');
        }
        recBuffersRef.current.push(new Float32Array(input));
      };

      // Set recording start time and begin duration timer
      setRecordingStart(new Date());
      setElapsedSeconds(0);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = window.setInterval(() => setElapsedSeconds(prev => prev + 1), 1000);

      setIsRecording(true);
      toast({
        title: "Recording Started",
        description: "Speak clearly for best transcription results.",
      });
    } catch (error) {
      setIsRecording(false);
      setProcessing(false);
      toast({
        title: "Recording Error",
        description: "Microphone access failed.",
        variant: "destructive",
      });
    }
  }, [setIsRecording, toast]);

  // PCM conversion helper, with stats calculation for waveform
  function float32ToPCM16(floatBuf: Float32Array): Uint8Array {
    const out = new Uint8Array(floatBuf.length * 2);
    const view = new DataView(out.buffer);
    let peak = 0, rms = 0, zeros = 0;
    for (let i = 0; i < floatBuf.length; i++) {
      let s = Math.max(-1, Math.min(1, floatBuf[i]));
      if (Math.abs(s) > peak) peak = Math.abs(s);
      rms += s * s;
      if (s === 0) zeros++;
      const sample = s < 0 ? s * 32768 : s * 32767;
      view.setInt16(i * 2, sample, true);
    }
    rms = Math.sqrt(rms / floatBuf.length);
    // Small demo: also show 16 sample slice
    const example = Array.from(out.slice(0, 16));
    setLastChunkStats({
      peak: Math.round(peak * 1000) / 1000,
      rms: Math.round(rms * 1000) / 1000,
      zeros,
      length: floatBuf.length,
      example,
    });
    return out;
  }

  // flatten buffers with copy to new buffer
  function flattenBuffers(buffers: Float32Array[]) {
    const len = buffers.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Float32Array(len);
    let offset = 0;
    for (const arr of buffers) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  // Proper 24kHz PCM16 resampling: use offline context if needed
  async function toPCMBuffer(floatBuf: Float32Array, originalSampleRate: number): Promise<Uint8Array> {
    if (originalSampleRate === PCM_SAMPLE_RATE) return float32ToPCM16(floatBuf);
    const frames = Math.ceil(floatBuf.length * PCM_SAMPLE_RATE / originalSampleRate);
    const offlineCtx = new OfflineAudioContext(1, frames, PCM_SAMPLE_RATE);
    const buffer = offlineCtx.createBuffer(1, floatBuf.length, originalSampleRate);
    buffer.copyToChannel(floatBuf, 0, 0);
    const src = offlineCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(offlineCtx.destination);
    src.start();
    const rendered = await offlineCtx.startRendering();
    const resampled = rendered.getChannelData(0);
    return float32ToPCM16(resampled);
  }

  // Chunking logic: sends PCM, update stats for UI with the buffer
  const handleChunk = async (sampleRate: number) => {
    if (!recBuffersRef.current.length) return;
    setProcessing(true);
    const floatBuf = flattenBuffers(recBuffersRef.current);
    recBuffersRef.current = [];
    setLastRecordedChunk(floatBuf); // <-- For waveform UI

    const pcmData = await toPCMBuffer(floatBuf, sampleRate);

    // Log summary
    const isZero = pcmData.every(x => x === 0);
    console.log('[AudioRecorder] PCM chunk size:', pcmData.length, 'First bytes:', Array.from(pcmData.slice(0, 16)), 'All zero:', isZero);

    if (isZero) {
      console.error('[AudioRecorder] ERROR: Buffered chunk is all zero. Microphone silent or disconnected?');
      toast({
        title: "Audio Issue",
        description: "A chunk of audio was nearly silent! Your mic or system audio is not transmitting. Check permissions, device & volume.",
        variant: "destructive"
      });
    }
    // Prepare formData
    const formData = new FormData();
    formData.append('audio', new Blob([pcmData], { type: 'audio/raw' }), 'audio.pcm');
    // This endpoint doesn't require 'mode', 'deviceLabel' or sessionId (but keep them if you want for future use, or remove for minimal)
    // We'll keep only 'audio' since /transcribe-audio only needs this
    // Remove: mode, sessionId, deviceLabel

    // Auth
    let accessToken = '';
    if (session && session.access_token) accessToken = session.access_token;

    try {
      const res = await fetch(supabaseTranscribeURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData
      });
      if (res.status === 401 || res.status === 403) {
        toast({ title: "Authentication Error", description: "Session expired. Please sign in again.", variant: "destructive" });
        setIsRecording(false);
        stopRecording();
        return;
      }
      if (!res.ok) {
        const errorTxt = await res.text();
        toast({ title: "Transcription Chunk Failed", description: "A chunk failed to transcribe: " + errorTxt, variant: "destructive" });
        setProcessing(false);
        return;
      }
      const result = await res.json();

      // Flat transcript and words; speakerSegments not available here
      if (result.words && Array.isArray(result.words)) {
        // Optionally parse word segments if needed in the future
      }
      if (result.transcript) {
        setTranscript(prev => prev + (result.transcript ? '\n' + result.transcript : ''));
        onTranscription(result.transcript);
      }
    } catch (err) {
      toast({ title: "Network Error", description: "Network error while sending audio chunk.", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  // Elapsed MM:SS formatting
  const renderDuration = () => {
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Effect: when isRecording toggles, start/stop logic
  // useEffect(() => {
  //   if (isRecording) {
  //     startRecording();
  //     return () => {};
  //   } else {
  //     if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  //     if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
  //     if (recBuffersRef.current.length && audioContextRef.current) {
  //       handleChunk(audioContextRef.current.sampleRate);
  //     }
  //     stopRecording();
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [isRecording]);

  useEffect(() => {
      toast({ title: "Test", description: "Testing to see if my changes are committed", variant: "destructive" });
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      if (processorRef.current) processorRef.current.disconnect();
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(tr => tr.stop());
    };
  }, []);

  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Live Recording</h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsRecording(!isRecording)}
              variant={isRecording ? "destructive" : "default"}
              className={isRecording ? "bg-red-600 hover:bg-red-700" : "bg-purple-600 hover:bg-purple-700"}
              disabled={processing}
            >
              {isRecording ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Start Recording
                </>
              )}
            </Button>
          </div>
        </div>
        {isRecording && (
          <div className="flex flex-col md:flex-row gap-2 mb-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-white text-sm">Recording in progress...</span>
              <span className="text-white font-mono text-xs bg-white/10 px-2 py-1 rounded ml-2">
                {renderDuration()}
              </span>
            </div>
            {/* Waveform + stats */}
            <div className="flex items-center gap-3 mt-2 md:mt-0">
              <AudioWaveformVisualizer buffer={lastRecordedChunk} width={220} height={32} />
              {lastChunkStats && (
                <div className="text-xs text-white bg-black/30 px-2 py-1 rounded border border-white/10 ml-2">
                  <span>len: {lastChunkStats.length}</span>{" "}
                  <span>peak: {lastChunkStats.peak}</span>{" "}
                  <span>rms: {lastChunkStats.rms}</span>{" "}
                  <span>zeros: {lastChunkStats.zeros}</span>
                </div>
              )}
            </div>
          </div>
        )}
        {transcript && (
          <div className="bg-white/5 rounded-lg p-4 border border-white/10 mt-2">
            <h4 className="text-white font-medium mb-2">Live Transcript:</h4>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{transcript}</p>
            {segments.length > 0 && (
              <div className="mt-3">
                <h5 className="text-purple-400 font-semibold mb-1">Speakers:</h5>
                <ul className="text-xs text-slate-400">
                  {segments.map((seg, i) => (
                    <li key={i}><b>{seg.speaker}</b>: <span>{seg.text}</span> <span className="ml-2 text-green-400">{Math.round(seg.confidence * 100)}%</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AudioRecorder;
