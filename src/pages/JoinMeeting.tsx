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

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (virtualAudioStream) {
        virtualAudioStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
  };

  const handleTranscriptUpdate = (segments: TranscriptSegment[]) => {
    setTranscriptSegments(segments);
    // Combine all segments into a single transcript for saving
    const combinedTranscript = segments
      .map(segment => `[${segment.timestamp}] ${segment.speaker}: ${segment.text}`)
      .join('\n');
    setLiveTranscript(combinedTranscript);
  };

  const toggleVirtualAudioTranscription = () => {
    setIsVirtualAudioActive(!isVirtualAudioActive);
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
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 bg-white/10 border-white/20 text-xs md:text-base">
            <TabsTrigger
              value="audio"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              Audio Capture
            </TabsTrigger>
            <TabsTrigger
              value="virtual"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              Virtual Audio
            </TabsTrigger>
            <TabsTrigger
              value="upload"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              Upload Audio
            </TabsTrigger>
          </TabsList>

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
                <form onSubmit={handleAudioCaptureStart} className="space-y-5 md:space-y-6">
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
                    />
                    <p className="text-xs md:text-sm text-slate-400">
                      The title will be used to save your transcription note.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                    <Button
                      type="submit"
                      disabled={loading || !audioCaptureTitle.trim()}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-3 py-2"
                    >
                      {loading ? "Initializing..." : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Ready Audio Capture
                        </>
                      )}
                    </Button>
                    {!isRecording ? (
                      <Button
                        type="button"
                        onClick={startRealTimeTranscription}
                        className={`flex-1 bg-green-600 hover:bg-green-700 px-3 py-2`}
                        disabled={loading || !audioCaptureTitle.trim() || !!microphonePermError}
                      >
                        <Mic className="h-4 w-4 mr-2" />
                        Start Recording
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={stopRealTimeTranscription}
                        className="flex-1 bg-red-600 hover:bg-red-700 px-3 py-2"
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Stop Recording
                      </Button>
                    )}
                  </div>
                </form>
                {/* Show microphone permission error if present */}
                {microphonePermError && (
                  <div className="mt-4 bg-red-900/40 border border-red-400 text-white p-3 rounded flex flex-col sm:flex-row items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <div className="flex-1">
                      <b>Microphone Access Denied:</b>
                      <div className="mt-1 text-xs md:text-sm">
                        {microphonePermError}
                        <p className="mt-2 text-yellow-200">To re-enable, check your browser's address bar for a blocked camera/mic icon and allow access, then reload this page. <br />
                        On Chrome: Click the lock icon → Site settings → Allow Microphone, then reload.<br />
                        If the problem persists, try another browser.</p>
                      </div>
                    </div>
                  </div>
                )}
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
                {connectionStatus === 'error' && !microphonePermError && (
                  <div className="mt-4 flex flex-col sm:flex-row items-center gap-2">
                    <Button
                      type="button"
                      onClick={startRealTimeTranscription}
                      variant="secondary"
                      className="bg-yellow-500 hover:bg-yellow-600 text-black"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry Connection
                    </Button>
                    <span className="text-yellow-200 ml-2 text-xs">Trouble connecting? Check Deepgram API Key on backend.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Virtual Audio Mode */}
          <TabsContent value="virtual" className="mt-6 md:mt-8 space-y-4 md:space-y-6">
            <VirtualAudioSetup
              onDeviceSelected={handleVirtualDeviceSelected}
              onSetupComplete={handleVirtualAudioSetupComplete}
            />
            {virtualAudioStream && (
              <RealTimeTranscription
                audioStream={virtualAudioStream}
                onTranscriptUpdate={handleTranscriptUpdate}
                isActive={isVirtualAudioActive}
                onToggle={toggleVirtualAudioTranscription}
              />
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
                            {selectedFile ? selectedFile.name : 'Click to upload audio file'}
                          </p>
                          <p className="text-xs md:text-sm text-slate-400">Supports MP3, WAV, M4A, FLAC, and other formats</p>
                        </div>
                      </label>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading || !selectedFile}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-3 py-2"
                  >
                    {loading ? 'Processing...' : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Start Transcription
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Transcription Results */}
        {(transcriptionResults.length > 0 || transcriptSegments.length > 0) && (
          <Card className="mt-7 md:mt-8 bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-white text-lg md:text-xl">Transcription Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 md:space-y-4">
                {transcriptSegments.length > 0 ? (
                  transcriptSegments.map((segment, index) => (
                    <div key={segment.id || index} className="bg-white/5 rounded-lg p-3 md:p-4 border border-white/10 overflow-x-auto">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-1 md:mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-purple-400">{segment.speaker}</span>
                          <span className="text-xs text-slate-400">{segment.timestamp}</span>
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

// This file is now very long (>780 lines).
// Consider refactoring into smaller hooks/components for maintainability!
