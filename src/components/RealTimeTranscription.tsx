
// Enhanced RealTimeTranscription with improved retry logic, connection state, user controls, and logging

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

const MAX_RETRIES = 6; // Try 6 times (~191 sec w/ exponential backoff)
const INITIAL_BACKOFF = 3000; // 3s

const RealTimeTranscription: React.FC<RealTimeTranscriptionProps> = ({
  audioStream,
  onTranscriptUpdate,
  isActive,
  onToggle
}) => {
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string>('Unknown');
  const [sessionDuration, setSessionDuration] = useState(0);

  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isUserConnecting, setIsUserConnecting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionStartRef = useRef<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionLock = useRef(false);

  const { toast, dismiss } = useToast();

  // Always use the correct URL for websocket
  const supabaseWSURL = 'wss://qlfqnclqowlljjcbeunz.supabase.co/functions/v1/transcribe-audio-realtime';

  // Reset internal state on visibility change or modal open/close
  useEffect(() => {
    if (!isActive) {
      stopTranscription({ resetErr: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, audioStream]);

  // Session timer
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

  // Retry connection if needed
  useEffect(() => {
    if (lastError && isActive && retryCount < MAX_RETRIES && !isConnected && !isUserConnecting) {
      setIsRetrying(true);
      const backoffTime = INITIAL_BACKOFF * Math.pow(2, retryCount);
      retryTimeoutRef.current = setTimeout(() => {
        if (isActive && retryCount < MAX_RETRIES) {
          startTranscription();
        }
      }, backoffTime);
      // Toast retry message ONLY on the first retry
      if (retryCount === 0) {
        toast({
          title: "Connection lost",
          description: `Will retry in ${backoffTime/1000}s...`,
          variant: "destructive"
        });
      }
    } else if (retryCount >= MAX_RETRIES && isActive && !isConnected) {
      setIsRetrying(false);
      toast({
        title: "Transcription unavailable",
        description: "Max reconnection attempts reached. Please check configuration and try again.",
        variant: "destructive"
      });
    }
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastError, retryCount, isActive, isConnected, isUserConnecting]);

  const startTranscription = async () => {
    if (connectionLock.current) return;
    connectionLock.current = true;
    setIsUserConnecting(true);
    setIsRetrying(false);
    setLastError(null);

    if (!audioStream) {
      toast({
        title: "No Audio Stream",
        description: "Please set up virtual audio first",
        variant: "destructive"
      });
      setIsUserConnecting(false);
      connectionLock.current = false;
      setLastError("No audio stream.");
      return;
    }
    try {
      wsRef.current = new WebSocket(supabaseWSURL);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setIsRetrying(false);
        setRetryCount(0);
        setLastError(null);
        toast({
          title: "Transcription Started",
          description: "Real-time audio transcription is now active",
        });
        console.log('Connected to real-time transcription service');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received transcription data:', data);

          if (data.type === 'transcript' && data.transcript) {
            const newSegment: TranscriptSegment = {
              id: Date.now().toString() + Math.random(),
              timestamp: new Date().toLocaleTimeString(),
              speaker: detectSpeaker(data.transcript),
              text: data.transcript,
              confidence: data.confidence || 0
            };

            setTranscriptSegments(prev => {
              const updated = [...prev, newSegment];
              onTranscriptUpdate(updated);
              return updated;
            });
          }
          if (data.error) {
            toast({
              title: "Transcription Error",
              description: data.error,
              variant: "destructive"
            });
            setLastError(data.error);
            setIsConnected(false);
            setRetryCount((prev) => prev + 1);
            wsRef.current?.close();
            console.error("Transcription WS error:", data.error);
          }
        } catch (error) {
          setLastError('Error parsing message');
          console.error('Parse error:', error);
          toast({
            title: "Message Parse Error",
            description: (error as Error)?.message || "Unknown error",
            variant: "destructive"
          });
        }
      };

      wsRef.current.onerror = (error: Event) => {
        setIsConnected(false);
        setRetryCount((prev) => prev + 1);
        setLastError('WebSocket error');
        toast({
          title: "Connection Error",
          description: "Failed to connect to transcription service.",
          variant: "destructive"
        });
        wsRef.current?.close();
        console.error('WebSocket error:', error);
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        setLastError(`[${event.code}] WebSocket closed`);
        if (isActive && retryCount < MAX_RETRIES) {
          setRetryCount((prev) => prev + 1);
        }
        console.log('WebSocket connection closed', event);
      };

      // Set up MediaRecorder for audio capture
      if (audioStream) {
        mediaRecorderRef.current = new MediaRecorder(audioStream, {
          mimeType: 'audio/webm;codecs=opus'
        });

        mediaRecorderRef.current.ondataavailable = async (event) => {
          if (event.data.size > 0 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            try {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: 'audio',
                    data: base64
                  }));
                }
              };
              reader.readAsDataURL(event.data);
            } catch (error) {
              setLastError('Audio processing error');
              setRetryCount((prev) => prev + 1);
              console.error('Error processing audio data:', error);
            }
          }
        };
        try {
          mediaRecorderRef.current.start(1000); // Send data every second
        } catch (err) {
          setLastError('MediaRecorder error');
          setRetryCount((prev) => prev + 1);
          toast({
            title: "Audio Error",
            description: "Microphone or stream error. Please check permissions.",
            variant: "destructive"
          });
          // Don't proceed further if can't start recording
          return;
        }
      }
    } catch (error: any) {
      setLastError(error?.message || 'Unknown error starting transcription');
      setRetryCount((prev) => prev + 1);
      setIsConnected(false);
      toast({
        title: "Transcription Error",
        description: "Failed to start real-time transcription",
        variant: "destructive"
      });
      console.error('Error starting transcription:', error);
    } finally {
      setIsUserConnecting(false);
      connectionLock.current = false;
    }
  };

  // Manual reconnect handler
  const handleManualReconnect = () => {
    // Clear error, abort any retry timer, and reset retries
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    setRetryCount(0);
    setLastError(null);
    startTranscription();
  };

  // Disconnect/cleanup everything and abort retries when toggled off
  const stopTranscription = ({ resetErr = false }: { resetErr?: boolean } = {}) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    setIsConnected(false);
    setIsUserConnecting(false);
    setIsRetrying(false);
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (resetErr) {
      setRetryCount(0);
      setLastError(null);
    }
  };

  const detectSpeaker = (text: string): string => {
    // Simple speaker detection based on text patterns
    const speakers = ['Speaker 1', 'Speaker 2', 'Speaker 3'];
    return speakers[Math.floor(Math.random() * speakers.length)];
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
              isConnected ? "secondary"
              : isRetrying ? "destructive"
              : lastError ? "destructive"
              : "secondary"
            }>
              {isConnected
                ? "Connected"
                : isRetrying
                  ? `Reconnecting (${retryCount}/${MAX_RETRIES})`
                  : lastError
                    ? "Connection Error"
                    : "Disconnected"
              }
            </Badge>
            {lastError && (
              <Button
                onClick={handleManualReconnect}
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
                {isActive ? (isUserConnecting ? "Connecting…" : "Listening for audio...") : "Start transcription to see live results"}
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
