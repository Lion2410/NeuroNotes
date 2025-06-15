import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

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

const supabaseWSURL = 'https://qlfqnclqowlljjcbeunz.supabase.co/functions/v1/transcribe-audio-realtime';

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

  // duration state
  const [recordingStart, setRecordingStart] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // references
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const timerRef = useRef<number | null>(null); // handles chunking
  const elapsedTimerRef = useRef<number | null>(null); // handles duration
  const recBuffersRef = useRef<Float32Array[]>([]);
  const sessionIdRef = useRef<string | null>(null);

  const fullSpeakerSegmentsRef = useRef<SpeakerSegment[]>([]);

  // Cleanup and finalize
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setProcessing(false);

    // Stop everything
    if (processorRef.current) processorRef.current.disconnect();
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    // Stop duration timer
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }

    setElapsedSeconds(0);
    setRecordingStart(null);

    // Finalize transcript
    const transcriptText = fullSpeakerSegmentsRef.current
      .map(seg => `[${seg.speaker}]: ${seg.text}`)
      .join('\n');
    onFinalized(transcriptText, [...fullSpeakerSegmentsRef.current]);
    toast({
      title: "Recording Stopped",
      description: "Transcription finalized and ready.",
    });
  }, [onFinalized, setIsRecording, toast]);

  // Start Recording
  const startRecording = useCallback(async () => {
    setTranscript('');
    setSegments([]);
    setProcessing(false);
    fullSpeakerSegmentsRef.current = [];
    sessionIdRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        // Accumulate raw audio data
        recBuffersRef.current.push(new Float32Array(input));
      };

      // Set recording start time and begin duration timer
      const now = new Date();
      setRecordingStart(now);
      setElapsedSeconds(0);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = window.setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);

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

  // Convert & send chunk to edge func
  const handleChunk = async (sampleRate: number) => {
    if (!recBuffersRef.current.length) return;
    setProcessing(true);
    const floatBuf = flattenBuffers(recBuffersRef.current);
    recBuffersRef.current = [];
    const pcmData = await toPCMBuffer(floatBuf, sampleRate);

    const formData = new FormData();
    formData.append('audio', new Blob([pcmData], { type: 'audio/raw' }), 'audio.pcm');
    formData.append('mode', 'microphone');
    if (sessionIdRef.current) formData.append('sessionId', sessionIdRef.current);
    if (user?.id) formData.append('deviceLabel', 'microphone');

    // Get freshest auth token from Supabase session
    let accessToken = '';
    if (session && session.access_token) {
      accessToken = session.access_token;
    }

    try {
      const res = await fetch(supabaseWSURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData
      });

      if (res.status === 401 || res.status === 403) {
        // Fatal: lose auth, must stop
        toast({
          title: "Authentication Error",
          description: "Your session has expired or is invalid. Please sign in again.",
          variant: "destructive",
        });
        setIsRecording(false);
        stopRecording();
        return;
      }
      if (!res.ok) {
        // Non-fatal: just inform and keep going
        const errorTxt = await res.text();
        toast({
          title: "Transcription Chunk Failed",
          description: "A chunk failed to transcribe: " + errorTxt,
          variant: "destructive"
        });
        // Don't stop; chunk is lost, move on
        setProcessing(false);
        return;
      }
      const result = await res.json();
      if (result.sessionId) sessionIdRef.current = result.sessionId;

      if (result.speakerSegments && Array.isArray(result.speakerSegments)) {
        fullSpeakerSegmentsRef.current = [
          ...fullSpeakerSegmentsRef.current,
          ...(result.speakerSegments as SpeakerSegment[])
        ];
        setSegments([...fullSpeakerSegmentsRef.current]);
        const transText = (result.speakerSegments as SpeakerSegment[])
          .map(seg => `[${seg.speaker}]: ${seg.text}`).join('\n');
        setTranscript(prev => prev + (transText ? '\n' + transText : ''));
        onTranscription(transText);
      } else if (result.transcript) {
        setTranscript(prev => prev + (result.transcript ? '\n' + result.transcript : ''));
        onTranscription(result.transcript);
      }
    } catch (err) {
      // Network error or similar—notify, but don't end session
      toast({
        title: "Network Error",
        description: "Temporary network error while sending audio chunk. Will continue recording.",
        variant: "destructive"
      });
      // Just skip this chunk/try, keep going
    } finally {
      setProcessing(false);
    }
  };

  // Helper: flatten array of Float32 arrays to 1D Float32Array
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

  // Resample & PCM16
  async function toPCMBuffer(floatBuf: Float32Array, originalSampleRate: number): Promise<Uint8Array> {
    if (originalSampleRate === PCM_SAMPLE_RATE) return float32ToPCM16(floatBuf);
    // Resample using OfflineAudioContext
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

  function float32ToPCM16(floatBuf: Float32Array): Uint8Array {
    const out = new Uint8Array(floatBuf.length * 2);
    for (let i = 0; i < floatBuf.length; i++) {
      let s = Math.max(-1, Math.min(1, floatBuf[i]));
      s = s < 0 ? s * 32768 : s * 32767;
      const val = Math.round(s);
      out[i * 2] = val & 0xFF;
      out[i * 2 + 1] = (val >> 8) & 0xFF;
    }
    return out;
  }

  // Elapsed MM:SS formatting
  const renderDuration = () => {
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // When isRecording toggles, start or stop logic
  useEffect(() => {
    if (isRecording) {
      startRecording();
      return () => {};
    } else {
      // Stop everything, flush remaining buffer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
      if (recBuffersRef.current.length && audioContextRef.current) {
        // Process remaining audio chunk
        handleChunk(audioContextRef.current.sampleRate);
      }
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      if (processorRef.current) processorRef.current.disconnect();
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
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
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-white text-sm">Recording in progress...</span>
            </div>
            <span className="text-white font-mono text-xs bg-white/10 px-2 py-1 rounded">
              {renderDuration()}
            </span>
          </div>
        )}
        {transcript && (
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
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
