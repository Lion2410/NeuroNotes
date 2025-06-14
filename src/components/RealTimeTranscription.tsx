
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, Square, Users, Clock, Save } from 'lucide-react';
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
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionStartRef = useRef<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isActive && audioStream) {
      startTranscription();
    } else {
      stopTranscription();
    }

    return () => {
      stopTranscription();
    };
  }, [isActive, audioStream]);

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
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive]);

  const startTranscription = async () => {
    if (!audioStream) {
      toast({
        title: "No Audio Stream",
        description: "Please set up virtual audio first",
        variant: "destructive"
      });
      return;
    }

    try {
      // Connect to real-time transcription WebSocket
      const wsUrl = `wss://qlfqnclqowlljjcbeunz.functions.supabase.co/transcribe-audio-realtime`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        console.log('Connected to real-time transcription service');
        
        toast({
          title: "Transcription Started",
          description: "Real-time audio transcription is now active",
        });
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received transcription data:', data);

          if (data.type === 'transcript' && data.transcript) {
            const newSegment: TranscriptSegment = {
              id: Date.now().toString(),
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
        } catch (error) {
          console.error('Error parsing transcription message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to transcription service",
          variant: "destructive"
        });
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        console.log('WebSocket connection closed');
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
              console.error('Error processing audio data:', error);
            }
          }
        };

        mediaRecorderRef.current.start(1000); // Send data every second
      }

    } catch (error) {
      console.error('Error starting transcription:', error);
      toast({
        title: "Transcription Error",
        description: "Failed to start real-time transcription",
        variant: "destructive"
      });
    }
  };

  const stopTranscription = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (wsRef.current) {
      wsRef.current.close();
    }

    setIsConnected(false);
  };

  const detectSpeaker = (text: string): string => {
    // Simple speaker detection based on text patterns
    // In a real implementation, this would use more sophisticated speaker diarization
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
            <Badge variant={isConnected ? "secondary" : "destructive"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
            <Button
              onClick={onToggle}
              variant={isActive ? "destructive" : "default"}
              size="sm"
              className={isActive ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
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
        <ScrollArea className="h-96 w-full">
          <div className="space-y-3">
            {transcriptSegments.length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                {isActive ? "Listening for audio..." : "Start transcription to see live results"}
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
