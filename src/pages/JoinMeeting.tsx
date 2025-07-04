import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Upload, Play, Save, Mic, MicOff, Square, CheckCircle, XCircle, AlertCircle, Headphones, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import VirtualAudioSetup from '@/components/VirtualAudioSetup';
import RealTimeTranscription from '@/components/RealTimeTranscription';
import { VirtualAudioDevice } from '@/utils/VirtualAudioDriver';
import AudioRecorder from '@/components/AudioRecorder';
import { useChunkedTranscription, ChunkTranscript } from "@/hooks/useChunkedTranscription";
import { Badge } from '@/components/ui/badge';

interface TranscriptSegment {
  id: string;
  timestamp: string;
  speaker?: string;
  text: string;
  confidence: number;
}

const JoinMeeting = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transcriptionResults, setTranscriptionResults] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [loading, setLoading] = useState(false);
  
  // Virtual audio states
  const [selectedVirtualDevice, setSelectedVirtualDevice] = useState<any>(null);
  const [virtualAudioStream, setVirtualAudioStream] = useState<MediaStream | null>(null);
  const [isVirtualAudioActive, setIsVirtualAudioActive] = useState(false);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  // MEETING MODE: audio (live capture) or upload
  const [meetingMode, setMeetingMode] = useState<'audio' | 'virtual' | 'upload'>('audio');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Add new state for audio capture note title
  const [audioCaptureTitle, setAudioCaptureTitle] = useState('');

  const [microphonePermError, setMicrophonePermError] = useState<string | null>(null);

  // New state for full speaker-labeled transcript segments via AudioRecorder
  const [speakerSegments, setSpeakerSegments] = useState<any[]>([]);

  // Add state for the new chunked transcription
  const [virtualAudioTranscripts, setVirtualAudioTranscripts] = useState<ChunkTranscript[]>([]);
  const [isVirtualRecording, setIsVirtualRecording] = useState(false);

  const authToken = window.sessionStorage.getItem('supabase.auth.token') || "";

  // Use new hook for virtual audio, only when Virtual tab & active
  const {
    isRecording: isVirtRecActive,
    isProcessing: isVirtRecProcessing,
    error: virtRecError,
    chunks: virtTranscripts,
    stop: stopVirtRecording,
    reset: resetVirtRecording,
  } = useChunkedTranscription({
    stream: virtualAudioStream,
    isActive: isVirtualRecording,
    authToken,
    onTranscriptsUpdate: setVirtualAudioTranscripts,
  });

  // Add debug state for MediaRecorder/running errors
  const [virtualMediaRecorderError, setVirtualMediaRecorderError] = useState<string | null>(null);

  // Virtual audio debug info for UI
  const [virtualAudioDebug, setVirtualAudioDebug] = useState<any>(null);

  // Track stream/manual restart for cleaner debug and state
  useEffect(() => {
    // Whenever the stream changes, log and reset chunks & recording
    setVirtualMediaRecorderError(null);
    setIsVirtualRecording(false);
    setVirtualAudioTranscripts([]);
    resetVirtRecording();
    if (virtualAudioStream) {
      console.log("[VirtualAudio] New stream attached:", virtualAudioStream);
      // Show media track info for debug UI
      setVirtualAudioDebug({
        active: virtualAudioStream.active,
        trackCount: virtualAudioStream.getTracks().length,
        tracks: virtualAudioStream.getTracks().map(t => ({
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: (t as any)?.muted,
          id: t.id
        })),
      });
    } else {
      setVirtualAudioDebug(null);
    }
  }, [virtualAudioStream, resetVirtRecording]);

  // Virtual audio handlers
  const handleVirtualDeviceSelected = (device: VirtualAudioDevice) => {
    setSelectedVirtualDevice(device);
    console.log('Selected virtual audio device:', device);
  };

  const handleVirtualAudioSetupComplete = (stream: MediaStream) => {
    setVirtualAudioStream(stream);
    toast({
      title: "Virtual Audio Ready",
      description: "Ready to capture meeting audio for transcription",
    });
    if (!stream) {
      setVirtualMediaRecorderError("MediaStream is null after setup!");
      console.error("[VirtualAudio] Setup returned a null stream.");
      return;
    }
    // Log stream properties for troubleshooting
    console.log("[VirtualAudio] Setup complete. Stream details:", {
      active: stream.active,
      trackCount: stream.getTracks().length,
      tracks: stream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        readyState: t.readyState,
        muted: (t as any)?.muted,
        id: t.id
      })),
      constraints: stream.getAudioTracks()[0]?.getSettings?.(),
    });
  };

  // --- OVERRIDE: toggleVirtualAudioTranscription with better error handling & codec fallback ---
  const toggleVirtualAudioTranscription = () => {
    setVirtualMediaRecorderError(null);

    if (!virtualAudioStream) {
      setVirtualMediaRecorderError("Virtual audio stream unavailable!");
      toast({
        title: "Audio Device Error",
        description: "No virtual audio stream is active. Please select and setup a device first.",
        variant: "destructive",
      });
      return;
    }
    // Check stream tracks live before starting
    const tracks = virtualAudioStream.getTracks();
    if (!tracks.length) {
      setVirtualMediaRecorderError("No media tracks present in virtual audio stream.");
      toast({
        title: "Audio Device Error",
        description: "No audio tracks found on selected virtual stream.",
        variant: "destructive",
      });
      return;
    }
    const audioTrack = virtualAudioStream.getAudioTracks()[0];
    if (!audioTrack) {
      setVirtualMediaRecorderError("No audio track found in stream!");
      toast({
        title: "Audio Track Error",
        description: "The selected audio device is not providing an active audio track.",
        variant: "destructive",
      });
      return;
    }
    if (isVirtualRecording) {
      stopVirtRecording();
      console.log("[VirtualAudio] Stopping chunked transcription (user toggle).");
    } else {
      setVirtualAudioTranscripts([]);
      resetVirtRecording();

      // Diagnosing common causes for MediaRecorder failing to start:
      // -- repeat try for codecs, show errors if it fails
      let recorder;
      let codecTried = '';
      try {
        codecTried = "audio/webm;codecs=opus";
        recorder = new MediaRecorder(virtualAudioStream, { mimeType: codecTried });
        console.log("[VirtualAudio] MediaRecorder created with", codecTried);
      } catch (err1) {
        try {
          codecTried = "audio/webm";
          recorder = new MediaRecorder(virtualAudioStream, { mimeType: codecTried });
          console.log("[VirtualAudio] MediaRecorder created with fallback", codecTried);
        } catch (err2) {
          try {
            codecTried = "";
            recorder = new MediaRecorder(virtualAudioStream);
            console.log("[VirtualAudio] MediaRecorder created with default mimeType.");
          } catch (errFinal) {
            console.error("[VirtualAudio] Failed to create MediaRecorder with any mimeType.", errFinal);
            setVirtualMediaRecorderError("Failed to create MediaRecorder: " + (errFinal && errFinal.message ? errFinal.message : errFinal));
            toast({
              title: "MediaRecorder Error",
              description: "Cannot record from selected audio device: " + (errFinal?.message || "unknown error"),
              variant: "destructive"
            });
            return;
          }
        }
      }
      // If it makes it here, log success and proceed with normal handler
      console.log("[VirtualAudio] Starting virtual chunked transcription (MediaRecorder mode:", codecTried || "default", ").");
      setVirtualMediaRecorderError(null);
      setIsVirtualRecording(true);
    }
    setIsVirtualRecording((prev) => !prev);
  };

  // Replace this line:
  // const supabaseWSURL = 'wss://qlfqnclqowlljjcbeunz.functions.supabase.co/transcribe-audio-realtime';
  // with the proper websocket function endpoint below!
  const supabaseWSURL = 'wss://qlfqnclqowlljjcbeunz.supabase.co/functions/v1/transcribe-audio-realtime';

  const startRealTimeTranscription = async () => {
    try {
      setConnectionStatus('connecting');
      setMicrophonePermError(null);

      // Request microphone access
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (mediaErr: any) {
        let errorMsg = "Failed to access microphone.";
        let systemMsg = "";
        if (
          mediaErr &&
          (mediaErr.name === "NotAllowedError" ||
            mediaErr.name === "PermissionDeniedError" ||
            mediaErr.message?.toLowerCase().includes("denied"))
        ) {
          errorMsg = "Microphone permission denied by browser or system. Please check your browser's privacy settings and reload this page, or try a different browser.";
          setMicrophonePermError(errorMsg);
          setConnectionStatus('error');
          toast({
            title: "Microphone Access Blocked",
            description: errorMsg,
            variant: "destructive",
          });
          // Do NOT retry when denied by user
          return;
        } else {
          systemMsg =
            typeof mediaErr === "string"
              ? mediaErr
              : mediaErr.message || JSON.stringify(mediaErr);
          toast({
            title: "Microphone Error",
            description: `${errorMsg} Details: ${systemMsg}`,
            variant: "destructive",
          });
          setMicrophonePermError(systemMsg);
          setConnectionStatus('error');
          // Could be a transient error, but don't auto-retry, leave to user
          return;
        }
      }

      // Create MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      // Setup WebSocket connection
      wsRef.current = new WebSocket(supabaseWSURL);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        toast({
          title: "Connected",
          description: "Real-time transcription started.",
        });
        console.log("WebSocket connection established");
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
        // Prevent auto-reconnecting for permission issues; allow user to manually retry
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
        setIsConnected(false);

        if (!microphonePermError) {
          toast({
            title: "Connection Error",
            description: "Failed to connect to transcription service. Please check your network and Deepgram API Key, then retry.",
            variant: "destructive"
          });
        }
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        // No retry; let user manually retry
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('idle');
        // Only try to reconnect if not a permission error and was recording
        if (
          event.code !== 1000 &&
          isRecording &&
          !microphonePermError
        ) {
          toast({
            title: "Lost Connection",
            description: "WebSocket disconnected. Click Retry Connection below.",
            variant: "destructive"
          });
        }
      };

      // Setup MediaRecorder events
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

      // Start recording
      mediaRecorderRef.current.start(1000); // Send data every second
      setIsRecording(true);
    } catch (error: any) {
      setConnectionStatus('error');
      setIsConnected(false);
      let errorMessage = error?.message || "Failed to access microphone or connect to transcription service.";
      if (
        error?.name === "NotAllowedError" ||
        error?.name === "PermissionDeniedError" ||
        errorMessage.toLowerCase().includes("denied")
      ) {
        errorMessage = "Microphone permission denied by browser or system. Please check your browser's privacy settings and reload this page, or try a different browser.";
        setMicrophonePermError(errorMessage);
        toast({
          title: "Microphone Access Blocked",
          description: errorMessage,
          variant: "destructive"
        });
        // Don't retry
        return;
      } else {
        toast({
          title: "Setup Error",
          description: errorMessage,
          variant: "destructive"
        });
        setMicrophonePermError(errorMessage);
        // Don't retry; let user decide
        return;
      }
    }
  };

  const stopRealTimeTranscription = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User stopped recording');
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setIsRecording(false);
    setIsConnected(false);
    setConnectionStatus('idle');
    
    // Add the live transcript to results
    if (liveTranscript.trim()) {
      setTranscriptionResults(prev => [...prev, liveTranscript.trim()]);
      setLiveTranscript('');
    }
    setMicrophonePermError(null);
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast({
        title: "File Required",
        description: "Please select an audio file to upload",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('audio', selectedFile);
      
      const response = await fetch('https://qlfqnclqowlljjcbeunz.supabase.co/functions/v1/transcribe-audio', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZnFuY2xxb3dsbGpqY2JldW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNTMwNzMsImV4cCI6MjA2NDYyOTA3M30.tt4NjuhDuBuuKOBvuoaAJIqxt_wmBRlm2KlN_-l-_UU`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const result = await response.json();
      if (result.transcript) {
        setTranscriptionResults([result.transcript]);
        toast({
          title: "Transcription Complete",
          description: "Your audio file has been successfully transcribed."
        });
      }
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to transcribe audio file. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('audio/')) {
        setSelectedFile(file);
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please select an audio file (mp3, wav, m4a, etc.)",
          variant: "destructive"
        });
      }
    }
  };

  // Remove meetingUrl validation for bot, now use audioCaptureTitle for audio capture
  const handleAudioCaptureStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioCaptureTitle.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a title for your note.",
        variant: "destructive"
      });
      return;
    }
    setLoading(true);

    try {
      // Simulate ready state for audio capture setup (no meetingbot function)
      toast({
        title: "Ready for Audio Capture",
        description: "Click Start Recording to begin capturing and transcribing audio."
      });
    } catch (error: any) {
      toast({
        title: "Audio Capture Failed",
        description: error.message || "Failed to initialize audio capture.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // In the save function, use audioCaptureTitle if in audio capture mode
  const handleSaveTranscription = async () => {
    const transcriptToSave = transcriptSegments.length > 0 
      ? transcriptSegments.map(s => `[${s.timestamp}] ${s.speaker}: ${s.text}`).join('\n')
      : transcriptionResults.join(' ');

    if (!transcriptToSave.trim() || !user) {
      toast({
        title: "Nothing to Save",
        description: "No transcription results to save.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('transcriptions')
        .insert({
          user_id: user.id,
          title:
            meetingMode === 'audio'
              ? audioCaptureTitle
              : selectedFile?.name || selectedVirtualDevice?.label || 'Live Meeting Transcription',
          content: transcriptToSave,
          source_type: selectedFile ? 'upload' : meetingMode === 'audio' ? 'audio_capture' : 'meeting',
          audio_url: null,
          meeting_url: null,
          duration: null
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Transcription Saved",
        description: "Your transcription has been saved to your notes."
      });

      setTranscriptionResults([]);
      setTranscriptSegments([]);
      setSelectedFile(null);
      setAudioCaptureTitle('');
      setMeetingMode('audio');
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save transcription. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'starting':
      case 'connecting':
        return <AlertCircle className="h-4 w-4 text-yellow-400 animate-pulse" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black">
      {/* Header */}
      <header className="px-4 md:px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link to="/notes" className="text-white hover:text-purple-400 transition-colors">
              <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
            </Link>
            <div className="flex items-center space-x-2">
              <img src="/lovable-uploads/2d11ec38-9fc4-4af5-9224-4b5b20a91803.png" alt="NeuroNotes" className="h-9 w-auto sm:h-12" />
              <span className="text-lg md:text-2xl font-bold text-white">NeuroNotes</span>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4 mt-2 sm:mt-0">
            <span className="text-white text-sm md:text-base truncate max-w-[160px] sm:max-w-xs">{user?.email}</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-2 md:px-6 py-7 md:py-12">
        <div className="text-center mb-7 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-4">Start Transcription</h1>
          <p className="text-base md:text-xl text-slate-300">Capture audio live (microphone or virtual) or upload audio for transcription</p>
        </div>

        <Tabs
          value={meetingMode}
          onValueChange={(val) => setMeetingMode(val as 'audio' | 'virtual' | 'upload')}
          defaultValue="audio"
          className="w-full"
        >
          <TabsList
            className="grid w-full grid-cols-3 bg-white/10 border-white/20 text-xs md:text-base mb-3 fixed bottom-0 left-0 right-0 z-20 md:static md:mb-0"
            style={{
              maxWidth: "100vw",
              borderRadius: 0,
              boxShadow: "0 -2px 16px 0 rgba(60,0,120,0.05)",
              marginLeft: 0,
              marginRight: 0
            }}
          >
            <TabsTrigger
              value="audio"
              className="py-3 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              Audio Capture
            </TabsTrigger>
            <TabsTrigger
              value="virtual"
              className="py-3 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              Virtual Audio
            </TabsTrigger>
            <TabsTrigger
              value="upload"
              className="py-3 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              Upload Audio
            </TabsTrigger>
          </TabsList>

          <div className="pb-20 md:pb-0">
            {/* Audio Capture Mode */}
            <TabsContent value="audio" className="mt-6 md:mt-8 space-y-4 md:space-y-6">
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <CardTitle className="text-white text-lg md:text-xl">Audio Capture Mode</CardTitle>
                  <CardDescription className="text-slate-300 text-sm md:text-base">
                    Use your microphone to capture and transcribe audio in real-time. Give your note a descriptive title below before recording.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      // No more "Ready Audio Capture"
                    }}
                    className="space-y-5 md:space-y-6"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="note-title" className="text-white">Title</Label>
                      <Input
                        id="note-title"
                        type="text"
                        placeholder="Enter a descriptive note title"
                        value={audioCaptureTitle}
                        onChange={(e) => setAudioCaptureTitle(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                        required
                        disabled={isRecording}
                      />
                      <p className="text-xs md:text-sm text-slate-400">
                        The title will be used to save your transcription note.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                      <Button
                        type="button"
                        onClick={() => setIsRecording((prev) => !prev)}
                        disabled={!audioCaptureTitle.trim()}
                        className={isRecording
                          ? "flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2"
                          : "flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2"}
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
                  </form>
                  <AudioRecorder
                    onTranscription={(chunkText) => {
                      setLiveTranscript(prev => prev + (chunkText ? "\n" + chunkText : ""));
                    }}
                    onFinalized={(fullText, segmentsArr) => {
                      setLiveTranscript(fullText);
                      setSpeakerSegments(segmentsArr);
                      setTranscriptionResults([fullText]);
                    }}
                    isRecording={isRecording}
                    setIsRecording={setIsRecording}
                  />
                  {/* Live Transcript Display */}
                  {(isRecording || liveTranscript) && (
                    <div className="mt-4 md:mt-6">
                      <h3 className="text-white font-semibold mb-2 md:mb-3">Live Transcript</h3>
                      <div className="bg-white/5 rounded-lg p-3 md:p-4 border border-white/10 min-h-[70px] max-h-52 md:max-h-[300px] overflow-y-auto">
                        <p className="text-slate-300 leading-relaxed text-xs md:text-base break-words whitespace-pre-line">
                          {liveTranscript || (isRecording ? "Listening..." : "No transcript yet")}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Virtual Audio Mode */}
            <TabsContent value="virtual" className="mt-6 md:mt-8 space-y-4 md:space-y-6">
              {/* Live Stream/Device Debug Inspector */}
              {meetingMode === "virtual" && (
                <div className="mb-4">
                  <div className="rounded bg-slate-900/90 border border-slate-700 px-4 py-3 text-xs text-slate-200">
                    <span className="font-bold text-purple-400 mr-2">Virtual Audio Debug</span>
                    {virtualAudioDebug ? (
                      <div>
                        <div>Stream active: <span className={virtualAudioDebug.active ? "text-green-400" : "text-red-400"}>{String(virtualAudioDebug.active)}</span></div>
                        <div>Tracks: {virtualAudioDebug.trackCount}</div>
                        {virtualAudioDebug.tracks.map((track: any, idx: number) => (
                          <div key={track.id || idx} className="ml-2">
                            {track.kind} (id={track.id}) enabled: <span className={track.enabled ? "text-green-400" : "text-red-400"}>{String(track.enabled)}</span>
                            , readyState: {track.readyState}
                            {typeof track.muted !== "undefined" && <>, muted: {String(track.muted)}</>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-red-400">No virtual audio stream assigned</div>
                    )}
                  </div>
                </div>
              )}
              <VirtualAudioSetup
                onDeviceSelected={handleVirtualDeviceSelected}
                onSetupComplete={handleVirtualAudioSetupComplete}
              />
              {virtualMediaRecorderError && (
                <div className="mb-2 rounded bg-red-950/70 border border-red-700 px-4 py-2 text-xs text-red-300">
                  <strong>Error:</strong> {virtualMediaRecorderError}
                </div>
              )}
              {virtualAudioStream && (
                <Card className="bg-white/10 backdrop-blur-md border-white/20 p-0">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white flex items-center gap-2">
                        <Mic className="h-5 w-5 text-purple-400" />
                        System Audio Transcription <span className="ml-2 text-xs text-purple-200">(10s chunks)</span>
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button
                          onClick={toggleVirtualAudioTranscription}
                          variant={isVirtualRecording ? "destructive" : "default"}
                          size="sm"
                          className={isVirtualRecording ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
                          disabled={isVirtRecProcessing}
                        >
                          {isVirtualRecording ? (
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
                        {isVirtRecProcessing && (
                          <Badge className="bg-purple-800 text-white">Processing…</Badge>
                        )}
                      </div>
                    </div>
                    {virtRecError && (
                      <Alert className="mt-3" variant="destructive">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        <AlertDescription>{virtRecError}</AlertDescription>
                      </Alert>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="h-72 overflow-y-auto scrollbar-thin">
                      {virtualAudioTranscripts.length === 0 ? (
                        <div className="text-center text-slate-300 pt-14">No transcript yet. Start to capture system audio.</div>
                      ) : (
                        virtualAudioTranscripts.map((chunk, i) => (
                          <div key={chunk.id} className="mb-3 p-3 rounded bg-white/10 border border-white/10">
                            <span className="text-xs text-purple-300">Chunk #{i + 1}</span>
                            {chunk.error ? (
                              <p className="text-red-400">{chunk.error}</p>
                            ) : (
                              <p className="text-slate-200 whitespace-pre-line">{chunk.transcript}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    {virtualAudioTranscripts.length > 0 && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          onClick={() => {
                            setVirtualAudioTranscripts([]);
                            resetVirtRecording();
                          }}
                          variant="outline"
                          size="sm"
                          className="border-white/30 text-white"
                        >
                          Clear
                        </Button>
                        <Button
                          onClick={() => {
                            const allChunks = virtualAudioTranscripts.map(t => t.transcript).join("\n");
                            navigator.clipboard.writeText(allChunks);
                          }}
                          variant="outline"
                          size="sm"
                          className="border-white/30 text-white"
                        >
                          Copy All
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Upload Audio Mode */}
            <TabsContent value="upload" className="mt-6 md:mt-8">
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2 text-lg md:text-xl">
                    <Upload className="h-5 w-5 text-purple-400" />
                    Upload Audio File
                  </CardTitle>
                  <CardDescription className="text-slate-300">Upload a meeting or audio file for AI-powered transcription</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleFileUpload} className="space-y-4 md:space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="audio-file" className="text-white">Audio File</Label>
                      <div className="border-2 border-dashed border-white/20 rounded-lg p-5 md:p-8 text-center hover:border-purple-400 transition-colors">
                        <input
                          id="audio-file"
                          type="file"
                          accept="audio/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <label htmlFor="audio-file" className="cursor-pointer flex flex-col items-center gap-3 md:gap-4">
                          <Upload className="h-8 w-8 md:h-12 md:w-12 text-slate-400" />
                          <div>
                            <p className="text-white font-medium text-sm md:text-base">
                              {selectedFile ? selectedFile.name : 'Tap to upload audio file'}
                            </p>
                            <p className="text-xs md:text-sm text-slate-400">Supports MP3, WAV, M4A, FLAC, and more</p>
                          </div>
                        </label>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={loading || !selectedFile}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-3 py-4 text-base md:text-lg"
                      style={{ minHeight: 48 }}
                    >
                      {loading ? 'Processing...' : (
                        <>
                          <Upload className="h-5 w-5 mr-2" />
                          Start Transcription
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        {/* Transcription Results */}
        {(transcriptionResults.length > 0 || transcriptSegments.length > 0 || speakerSegments.length > 0) && (
          <Card className="mt-7 md:mt-8 bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-white text-lg md:text-xl">Transcription Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 md:space-y-4">
                {speakerSegments.length > 0 ? (
                  speakerSegments.map((segment, index) => (
                    <div key={index} className="bg-white/5 rounded-lg p-3 md:p-4 border border-white/10 overflow-x-auto">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-1 md:mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-purple-400">{segment.speaker}</span>
                        </div>
                        <span className="text-xs text-green-400 mt-1 sm:mt-0">
                          {Math.round(segment.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-xs md:text-base break-words">{segment.text}</p>
                    </div>
                  ))
                ) : (
                  transcriptionResults.map((text, index) => (
                    <div key={index} className="bg-white/5 rounded-lg p-3 md:p-4 border border-white/10 overflow-x-auto">
                      <p className="text-slate-300 leading-relaxed text-xs md:text-base break-words">{text}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 md:mt-4 flex flex-col md:flex-row gap-2">
                <Button
                  onClick={handleSaveTranscription}
                  disabled={saving}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-3 py-2"
                >
                  {saving ? 'Saving...' : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save to Notes
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    const transcriptText = transcriptSegments.length > 0
                      ? transcriptSegments.map(s => `[${s.timestamp}] ${s.speaker}: ${s.text}`).join('\n')
                      : transcriptionResults.join(' ');
                    navigator.clipboard.writeText(transcriptText);
                  }}
                  variant="outline"
                  className="border-white/30 hover:bg-white/10 text-slate-950 px-3 py-2"
                >
                  Copy All
                </Button>
                <Button
                  onClick={() => {
                    setTranscriptionResults([]);
                    setTranscriptSegments([]);
                    setSpeakerSegments([]);
                  }}
                  variant="outline"
                  className="border-white/30 hover:bg-white/10 text-slate-950 px-3 py-2"
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default JoinMeeting;
// This file is now very long (>870 lines).
// Consider refactoring into smaller hooks/components for maintainability!
