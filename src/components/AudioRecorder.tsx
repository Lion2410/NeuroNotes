
import React, { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface AudioRecorderProps {
  onTranscription: (text: string) => void;
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onTranscription,
  isRecording,
  setIsRecording,
}) => {
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
  }, [setIsRecording, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      toast({
        title: "Recording Stopped",
        description: "Processing transcription...",
      });
    }
  }, [isRecording, setIsRecording, toast]);

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const response = await fetch('/functions/v1/transcribe-audio', {
        method: 'POST',
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
    <Card className="bg-white/10 backdrop-blur-md border-white/20">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Live Recording</h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              variant={isRecording ? "destructive" : "default"}
              className={isRecording ? "bg-red-600 hover:bg-red-700" : "bg-purple-600 hover:bg-purple-700"}
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
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-white text-sm">Recording in progress...</span>
          </div>
        )}

        {transcript && (
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <h4 className="text-white font-medium mb-2">Live Transcript:</h4>
            <p className="text-slate-300 text-sm leading-relaxed">{transcript}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AudioRecorder;
