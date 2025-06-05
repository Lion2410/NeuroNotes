
import React, { useState, useRef, useCallback } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface RoundRecordingButtonProps {
  onTranscription: (text: string) => void;
}

const RoundRecordingButton: React.FC<RoundRecordingButtonProps> = ({
  onTranscription,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Collect data every second
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
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      toast({
        title: "Recording Stopped",
        description: "Processing transcription...",
      });
    }
  }, [isRecording, toast]);

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const response = await fetch('https://qlfqnclqowlljjcbeunz.supabase.co/functions/v1/transcribe-audio', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZnFuY2xxb3dsbGpqY2JldW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNTMwNzMsImV4cCI6MjA2NDYyOTA3M30.tt4NjuhDuBuuKOBvuoaAJIqxt_wmBRlm2KlN_-l-_UU'}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const result = await response.json();
      
      if (result.transcript) {
        setTranscript(prev => prev + ' ' + result.transcript);
        onTranscription(result.transcript);
        
        toast({
          title: "Transcription Complete",
          description: "Audio has been transcribed successfully",
        });
      }

    } catch (error) {
      console.error('Transcription error:', error);
      toast({
        title: "Transcription Error",
        description: "Failed to transcribe audio. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-8">
      <div className="relative">
        <Button
          onClick={isRecording ? stopRecording : startRecording}
          className={`
            w-32 h-32 rounded-full border-4 transition-all duration-300 transform
            ${isRecording 
              ? 'bg-red-600 hover:bg-red-700 border-red-400 animate-pulse scale-110' 
              : 'bg-purple-600 hover:bg-purple-700 border-purple-400 hover:scale-105'
            }
          `}
        >
          {isRecording ? (
            <Square className="h-12 w-12 text-white" />
          ) : (
            <Mic className="h-12 w-12 text-white" />
          )}
        </Button>
        
        {isRecording && (
          <div className="absolute -inset-4 border-4 border-red-400 rounded-full animate-ping opacity-75"></div>
        )}
      </div>
      
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-2">
          {isRecording ? 'Recording in Progress' : 'Start Live Recording'}
        </h3>
        <p className="text-slate-300">
          {isRecording 
            ? 'Click the button again to stop recording' 
            : 'Click the button to start recording your meeting'
          }
        </p>
      </div>

      {transcript && (
        <Card className="w-full max-w-2xl bg-white/10 backdrop-blur-md border-white/20">
          <CardContent className="p-6">
            <h4 className="text-white font-medium mb-4">Live Transcript:</h4>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 max-h-60 overflow-y-auto">
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{transcript}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RoundRecordingButton;
