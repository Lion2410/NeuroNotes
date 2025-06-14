
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Square, Save, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface RealTimeTranscriberProps {
  onTranscriptionSaved?: (transcriptionId: string) => void;
}

const RealTimeTranscriber: React.FC<RealTimeTranscriberProps> = ({ onTranscriptionSaved }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [isSaving, setIsSaving] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  };

  const startRealTimeTranscription = useCallback(async () => {
    try {
      setConnectionStatus('connecting');
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });
      streamRef.current = stream;
      
      // Create MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      // Setup WebSocket connection
      const wsUrl = `wss://qlfqnclqowlljjcbeunz.supabase.co/functions/v1/transcribe-audio-realtime`;
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        toast({
          title: "Connected",
          description: "Real-time transcription started."
        });
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          
          if (data.type === 'transcript' && data.transcript) {
            setLiveTranscript(prev => prev + ' ' + data.transcript);
          } else if (data.type === 'connection' && data.status === 'connected') {
            console.log('WebSocket connection confirmed');
          } else if (data.error) {
            console.error('WebSocket error from server:', data.error);
            toast({
              title: "Transcription Error",
              description: data.error,
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
        setIsConnected(false);
        toast({
          title: "Connection Error",
          description: "Failed to connect to transcription service.",
          variant: "destructive"
        });
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('idle');
        
        // Auto-reconnect if it wasn't a manual close and we're still recording
        if (event.code !== 1000 && isRecording) {
          console.log('Attempting to reconnect...');
          reconnectTimeoutRef.current = setTimeout(() => {
            startRealTimeTranscription();
          }, 3000);
        }
      };

      // Setup MediaRecorder events
      mediaRecorderRef.current.ondataavailable = async (event) => {
        if (event.data.size > 0 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            // Convert audio blob to base64 and send via WebSocket
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

      // Start recording
      mediaRecorderRef.current.start(1000); // Send data every second
      setIsRecording(true);

    } catch (error: any) {
      setConnectionStatus('error');
      console.error('Microphone or WebSocket error:', error);
      toast({
        title: "Setup Error",
        description: error.message || "Failed to access microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  }, [isRecording, toast]);

  const stopRealTimeTranscription = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User stopped recording');
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setIsRecording(false);
    setIsConnected(false);
    setConnectionStatus('idle');
    
    toast({
      title: "Recording Stopped",
      description: "Transcription session ended."
    });
  }, [toast]);

  const saveTranscription = async () => {
    if (!liveTranscript.trim() || !user) {
      toast({
        title: "Nothing to Save",
        description: "No transcription content to save.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('transcriptions')
        .insert({
          user_id: user.id,
          title: `Live Transcription - ${new Date().toLocaleDateString()}`,
          content: liveTranscript.trim(),
          source_type: 'live_recording',
          audio_url: null,
          meeting_url: null,
          duration: null
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: "Transcription Saved",
        description: "Your transcription has been saved to your notes."
      });
      
      // Clear the transcript after saving
      setLiveTranscript('');
      
      // Notify parent component
      if (onTranscriptionSaved && data) {
        onTranscriptionSaved(data.id);
      }
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save transcription.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = async () => {
    if (!liveTranscript.trim()) {
      toast({
        title: "Nothing to Copy",
        description: "No transcription content to copy.",
        variant: "destructive"
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(liveTranscript);
      toast({
        title: "Copied",
        description: "Transcription copied to clipboard."
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard.",
        variant: "destructive"
      });
    }
  };

  const clearTranscription = () => {
    setLiveTranscript('');
    toast({
      title: "Cleared",
      description: "Transcription content cleared."
    });
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'connecting':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      case 'error':
        return 'Connection Error';
      default:
        return 'Ready';
    }
  };

  return (
    <Card className="bg-white border-gray-200">
      <CardHeader>
        <CardTitle className="text-gray-900 flex items-center justify-between">
          Real-Time Transcription
          <span className={`text-sm font-normal ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recording Controls */}
        <div className="flex items-center gap-2">
          {!isRecording ? (
            <Button
              onClick={startRealTimeTranscription}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Mic className="h-4 w-4 mr-2" />
              Start Recording
            </Button>
          ) : (
            <Button
              onClick={stopRealTimeTranscription}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop Recording
            </Button>
          )}
          
          {isRecording && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-gray-600 text-sm">Recording...</span>
            </div>
          )}
        </div>

        {/* Live Transcript Display */}
        {(isRecording || liveTranscript) && (
          <div className="space-y-3">
            <h4 className="text-gray-900 font-medium">Live Transcript:</h4>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 min-h-[150px] max-h-[400px] overflow-y-auto">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {liveTranscript || (isRecording ? "Listening..." : "No transcript yet")}
              </p>
            </div>
            
            {/* Action Buttons */}
            {liveTranscript.trim() && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={saveTranscription}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save to Notes'}
                </Button>
                <Button
                  onClick={copyToClipboard}
                  variant="outline"
                  className="border-gray-300 hover:bg-gray-50"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button
                  onClick={clearTranscription}
                  variant="outline"
                  className="border-gray-300 hover:bg-gray-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RealTimeTranscriber;
