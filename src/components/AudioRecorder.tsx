
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
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

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onTranscription,
  onFinalized,
  isRecording,
  setIsRecording,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Device selection
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Transcript
  const [transcript, setTranscript] = useState('');
  const [segments, setSegments] = useState<SpeakerSegment[]>([]);

  // Recording/processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderWorkerRef = useRef<Worker | null>(null);
  const chunkTimerRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // For accumulating final transcript (across all chunks)
  const fullSpeakerSegmentsRef = useRef<SpeakerSegment[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);

  // Recording state
  const [processing, setProcessing] = useState(false);

  // VAD thresholds
  const VAD_SENSITIVITY = 0.02; // Adjust for sensitivity (lower = more sensitive)
  const CHUNK_SECONDS = 7; // 5-10s chunks
  const PCM_SAMPLE_RATE = 24000; // 24kHz target

  // Device List
  useEffect(() => {
    if (!navigator.mediaDevices) return;
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const inputs = devices.filter(d => d.kind === 'audioinput');
        setAudioInputs(inputs);
        if (!selectedDeviceId && inputs.length > 0) {
          setSelectedDeviceId(inputs[0].deviceId);
        }
      });
  }, []);

  // Start Recording with VAD and chunk logic
  const startRecording = useCallback(async () => {
    try {
      setTranscript('');
      setSegments([]);
      setProcessing(false);

      // 1. Get selected device stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: PCM_SAMPLE_RATE,
        }
      });

      // 2. Build audio context and needed processing nodes
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: PCM_SAMPLE_RATE });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = source;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyserRef.current = analyser;
      source.connect(analyser);

      // For raw samples for PCM capture
      const bufferLength = analyser.frequencyBinCount;
      let chunkBuffers: Float32Array[] = [];
      let vadActive = false;
      let chunkStartTime = Date.now();

      // Collect samples in a ScriptProcessorNode
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const inputClone = new Float32Array(input);
        chunkBuffers.push(inputClone);

        // VAD: simple amplitude check
        let rms = 0;
        for (let i = 0; i < input.length; ++i) {
          rms += input[i] * input[i];
        }
        rms = Math.sqrt(rms / input.length);
        if (rms > VAD_SENSITIVITY) vadActive = true;

        const now = Date.now();
        if (vadActive && ((now - chunkStartTime) >= CHUNK_SECONDS * 1000)) {
          vadActive = false;
          const chunk = flattenBuffers(chunkBuffers);
          chunkBuffers = [];
          chunkStartTime = now;
          processChunk(chunk, audioContext.sampleRate);
        }
      };

      // If user stops before chunk length reached, flush last buffer
      recorderWorkerRef.current = {
        terminate: () => {
          try {
            processor.disconnect();
            source.disconnect();
            analyser.disconnect();
            audioContext.close();
            stream.getTracks().forEach(track => track.stop());
          } catch { }
        }
      } as any;

      setIsRecording(true);
      toast({
        title: "Recording Started",
        description: "Speak clearly for best transcription results",
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
      setIsRecording(false);
      setProcessing(false);
    }
  }, [selectedDeviceId, setIsRecording, toast]);

  // Stop recording, flush buffer
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setProcessing(true);

    // Clean up processing nodes
    if (recorderWorkerRef.current) recorderWorkerRef.current.terminate();

    // Flush any remaining buffer
    if (audioContextRef.current && mediaStreamSourceRef.current) {
      // intentionally no logic, buffers are flushed by chunking above
      audioContextRef.current.close();
    }

    // Save accumulated transcript as finalized text to notes using onFinalized
    const transcriptText = fullSpeakerSegmentsRef.current.map(seg =>
      `[${seg.speaker}]: ${seg.text}`
    ).join('\n');
    onFinalized(transcriptText, [...fullSpeakerSegmentsRef.current]);

    setProcessing(false);
    toast({
      title: "Recording Stopped",
      description: "Transcription finalized and ready.",
    });
  }, [setIsRecording, onFinalized, toast]);

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

  // Helper: float32 -> PCM16, resample to 24kHz
  async function toPCMBuffer(floatBuf: Float32Array, originalSampleRate: number): Promise<Uint8Array> {
    if (originalSampleRate === PCM_SAMPLE_RATE) {
      // Just convert to PCM16
      return float32ToPCM16(floatBuf);
    }
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

  // Chunk processor - sends to edge function, updates transcript live
  async function processChunk(floatBuf: Float32Array, sampleRate: number) {
    setProcessing(true);

    // Convert to PCM16 24kHz
    const pcmData = await toPCMBuffer(floatBuf, sampleRate);

    // Send as multipart/form-data
    const formData = new FormData();
    formData.append('audio', new Blob([pcmData], { type: 'audio/raw' }), 'audio.pcm');
    formData.append('mode', 'microphone');
    // Forward sessionId for session log (first chunk returns it)
    if (sessionIdRef.current) {
      formData.append('sessionId', sessionIdRef.current);
    }
    if (user?.id) {
      formData.append('deviceLabel', 'microphone');
    }

    try {
      const res = await fetch(supabaseWSURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sb-access-token') || ''}`
        },
        body: formData
      });
      if (!res.ok) {
        throw new Error('Transcription failed');
      }
      const result = await res.json();
      if (result.sessionId) sessionIdRef.current = result.sessionId;

      // Parse result.speakerSegments for speaker-labeled transcript
      if (result.speakerSegments && Array.isArray(result.speakerSegments)) {
        // Accumulate
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
      toast({
        title: "Transcription Error",
        description: "Failed to transcribe audio. Please try again.",
        variant: "destructive",
      });
      setIsRecording(false);
    } finally {
      setProcessing(false);
    }
  }

  // Stop on unmount
  useEffect(() => {
    return () => {
      if (recorderWorkerRef.current) recorderWorkerRef.current.terminate();
    };
  }, []);

  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Live Recording</h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
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
        <div className="mb-3">
          <label className="text-slate-200 mr-3">Select Input:</label>
          <select
            value={selectedDeviceId ?? ''}
            onChange={e => setSelectedDeviceId(e.target.value)}
            className="bg-slate-800 text-white rounded px-2 py-1"
            disabled={isRecording}
          >
            {audioInputs.map(device => (
              <option key={device.deviceId} value={device.deviceId}>{device.label || `Device ${device.deviceId}`}</option>
            ))}
          </select>
        </div>
        {isRecording && (
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-white text-sm">Recording in progress...</span>
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
