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

  // Refs for MediaRecorder and chunks
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const [lastRecordedChunk, setLastRecordedChunk] = useState<Float32Array | null>(null);
  const fullSpeakerSegmentsRef = useRef<SpeakerSegment[]>([]);
  const sessionIdRef = useRef<string | null>(null);

  // Stop logic
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setProcessing(false);

    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(tr => tr.stop());
      streamRef.current = null;
    }

    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setElapsedSeconds(0);
    setRecordingStart(null);

    const transcriptText = fullSpeakerSegmentsRef.current.map(seg => `[${seg.speaker}]: ${seg.text}`).join('\n');
    onFinalized(transcriptText, [...fullSpeakerSegmentsRef.current]);
    toast({ title: "Recording Stopped", description: "Transcription finalized and ready." });
  }, [onFinalized, setIsRecording, toast]);

  // Start logic
  const startRecording = useCallback(async () => {
    console.log("Starting recording setup...");
    setTranscript('');
    setSegments([]);
    setProcessing(false);
    fullSpeakerSegmentsRef.current = [];
    sessionIdRef.current = null;
    audioChunksRef.current = [];

    try {
      console.log("Requesting media stream...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Media stream acquired:", stream);
      streamRef.current = stream;

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const visualize = () => {
        analyser.getByteTimeDomainData(dataArray);
        setLastRecordedChunk(new Float32Array(dataArray));
        requestAnimationFrame(visualize);
      };
      visualize();

      console.log("Initializing MediaRecorder...");
      const mediaRecorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/wav') ? 'audio/wav' : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '') });
      mediaRecorderRef.current = mediaRecorder;
      console.log("MediaRecorder initialized.");

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          handleChunk(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) handleChunk(new Blob(audioChunksRef.current));
      };

      console.log("Starting MediaRecorder...");
      mediaRecorder.start(10000);

      setRecordingStart(new Date());
      setElapsedSeconds(0);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = setInterval(() => setElapsedSeconds(prev => prev + 1), 1000);

      setIsRecording(true);
      console.log("Recording started successfully.");
      toast({ title: "Recording Started", description: "Speak clearly for best transcription results." });
    } catch (error) {
      console.error("Recording error:", error.message, error.name);
      setIsRecording(false);
      setProcessing(false);
      toast({ title: "Recording Error", description: "Microphone access failed.", variant: "destructive" });
    }
  }, [setIsRecording, toast]);

  const handleChunk = async (chunk: Blob) => {
    console.log("Chunk received, size:", chunk.size, "type:", chunk.type);
    setProcessing(true);

    const formData = new FormData();
    formData.append('audio', chunk, 'audio.wav'); // Updated to match WAV

    let accessToken = '';
    if (session && session.access_token) accessToken = session.access_token;

    try {
      const res = await fetch(supabaseTranscribeURL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
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

      if (result.words && Array.isArray(result.words)) {
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

  const renderDuration = () => {
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isRecording) {
      startRecording();
      console.log("Recording toggled to start.");
      return () => {};
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach(tr => tr.stop());
      if (audioContext) audioContext.close();
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
            <div className="flex items-center gap-3 mt-2 md:mt-0">
              <AudioWaveformVisualizer buffer={lastRecordedChunk} width={220} height={32} />
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
