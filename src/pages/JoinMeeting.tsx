import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Upload, Play, Save, Mic, MicOff, Square, CheckCircle, XCircle, AlertCircle, Headphones } from 'lucide-react';
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
  const [meetingUrl, setMeetingUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transcriptionResults, setTranscriptionResults] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [meetingBotStatus, setMeetingBotStatus] = useState<'idle' | 'starting' | 'success' | 'error'>('idle');
  
  // Virtual audio states
  const [selectedVirtualDevice, setSelectedVirtualDevice] = useState<VirtualAudioDevice | null>(null);
  const [virtualAudioStream, setVirtualAudioStream] = useState<MediaStream | null>(null);
  const [isVirtualAudioActive, setIsVirtualAudioActive] = useState(false);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [meetingMode, setMeetingMode] = useState<'bot' | 'virtual'>('bot');
  
  // ... keep existing code (refs and other state)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

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

  const handleJoinMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingUrl.trim()) {
      toast({
        title: "Meeting URL Required",
        description: "Please enter a valid meeting URL",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    setMeetingBotStatus('starting');
    
    try {
      // Call the meeting bot function
      const { data, error } = await supabase.functions.invoke('meeting-bot', {
        body: { meetingUrl }
      });

      if (error) {
        throw error;
      }

      setMeetingBotStatus('success');
      toast({
        title: "Meeting Bot Started",
        description: "The bot is joining the meeting and will start transcribing."
      });

    } catch (error: any) {
      setMeetingBotStatus('error');
      toast({
        title: "Meeting Bot Failed",
        description: error.message || "Failed to start meeting bot. Please check the meeting URL and try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const startRealTimeTranscription = async () => {
    try {
      setConnectionStatus('connecting');
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      // Setup WebSocket connection for real-time transcription
      const wsUrl = `wss://qlfqnclqowlljjcbeunz.functions.supabase.co/transcribe-audio-realtime`;
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
          description: "Failed to connect to transcription service. Please try again.",
          variant: "destructive"
        });
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('idle');
        
        // Auto-reconnect if it wasn't a manual close
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
        description: error.message || "Failed to access microphone or connect to transcription service. Please check permissions.",
        variant: "destructive"
      });
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
          title: selectedFile?.name || selectedVirtualDevice?.label || 'Live Meeting Transcription',
          content: transcriptToSave,
          source_type: selectedFile ? 'upload' : 'meeting',
          audio_url: null,
          meeting_url: meetingUrl || null,
          duration: null
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Transcription Saved",
        description: "Your transcription has been saved to your notes."
      });
      
      // Clear the results after saving
      setTranscriptionResults([]);
      setTranscriptSegments([]);
      setSelectedFile(null);
      setMeetingUrl('');
      setMeetingBotStatus('idle');
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
      <header className="px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/notes" className="text-white hover:text-purple-400 transition-colors">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div className="flex items-center space-x-2">
              <img src="/lovable-uploads/2d11ec38-9fc4-4af5-9224-4b5b20a91803.png" alt="NeuroNotes" className="h-12 w-auto" />
              <span className="text-2xl font-bold text-white">NeuroNotes</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-white">Welcome, {user?.email}</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Start Transcription</h1>
          <p className="text-xl text-slate-300">Join a live meeting or upload recorded audio</p>
        </div>

        <Tabs defaultValue="meeting" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/10 border-white/20">
            <TabsTrigger value="meeting" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              Live Meeting
            </TabsTrigger>
            <TabsTrigger value="upload" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              Upload Audio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="meeting" className="mt-8 space-y-6">
            {/* Meeting Mode Selection */}
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Choose Meeting Mode</CardTitle>
                <CardDescription className="text-slate-300">
                  Select how you want to capture and transcribe meeting audio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    onClick={() => setMeetingMode('bot')}
                    variant={meetingMode === 'bot' ? 'default' : 'outline'}
                    className={`h-20 p-4 ${
                      meetingMode === 'bot'
                        ? 'bg-purple-600 hover:bg-purple-700'
                        : 'bg-white/20 hover:bg-white/30 border-none'
                    } text-white transition-all duration-200`}
                  >
                    <div className="text-center">
                      <ExternalLink className="h-6 w-6 mx-auto mb-2" />
                      <div className="font-medium">Meeting Bot</div>
                      <div className="text-sm opacity-75">Automatically join meetings</div>
                    </div>
                  </Button>
                  
                  <Button
                    onClick={() => setMeetingMode('virtual')}
                    variant={meetingMode === 'virtual' ? 'default' : 'outline'}
                    className={`h-20 p-4 ${
                      meetingMode === 'virtual'
                        ? 'bg-purple-600 hover:bg-purple-700'
                        : 'bg-white/20 hover:bg-white/30 border-none'
                    } text-white transition-all duration-200`}
                  >
                    <div className="text-center">
                      <Headphones className="h-6 w-6 mx-auto mb-2" />
                      <div className="font-medium">Virtual Audio</div>
                      <div className="text-sm opacity-75">Capture system audio</div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {meetingMode === 'virtual' && (
              <>
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
              </>
            )}

            {meetingMode === 'bot' && (
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <ExternalLink className="h-5 w-5 text-purple-400" />
                    Join Live Meeting
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    Enter the meeting URL and our bot will automatically join and transcribe the meeting
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Status Alerts */}
                  {meetingBotStatus === 'success' && (
                    <Alert className="mb-4 border-green-600 bg-green-600/10">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <AlertDescription className="text-green-400">
                        Meeting bot successfully started and joined the meeting.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {meetingBotStatus === 'error' && (
                    <Alert className="mb-4 border-red-600 bg-red-600/10">
                      <XCircle className="h-4 w-4 text-red-400" />
                      <AlertDescription className="text-red-400">
                        Failed to start meeting bot. Please check your meeting URL and try again.
                      </AlertDescription>
                    </Alert>
                  )}

                  <form onSubmit={handleJoinMeeting} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="meeting-url" className="text-white">Meeting URL</Label>
                      <Input
                        id="meeting-url"
                        type="url"
                        placeholder="https://meet.google.com/abc-defg-hij or https://zoom.us/j/..."
                        value={meetingUrl}
                        onChange={(e) => setMeetingUrl(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                        required
                      />
                      <p className="text-sm text-slate-400">
                        Supports Google Meet, Zoom, Microsoft Teams, and other popular platforms
                      </p>
                    </div>

                    <div className="flex gap-4">
                      <Button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                      >
                        {loading ? (
                          <div className="flex items-center gap-2">
                            {getStatusIcon(meetingBotStatus)}
                            Starting Bot...
                          </div>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Start Meeting Bot
                          </>
                        )}
                      </Button>
                      
                      {!isRecording ? (
                        <Button
                          type="button"
                          onClick={startRealTimeTranscription}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Mic className="h-4 w-4 mr-2" />
                          Start Recording
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          onClick={stopRealTimeTranscription}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <Square className="h-4 w-4 mr-2" />
                          Stop Recording
                        </Button>
                      )}
                    </div>

                    {/* Connection Status */}
                    {connectionStatus !== 'idle' && (
                      <div className="flex items-center gap-2">
                        {getStatusIcon(connectionStatus)}
                        <span className={`text-sm ${
                          connectionStatus === 'connected' ? 'text-green-400' :
                          connectionStatus === 'error' ? 'text-red-400' :
                          'text-yellow-400'
                        }`}>
                          {connectionStatus === 'connecting' && 'Connecting to transcription service...'}
                          {connectionStatus === 'connected' && 'Connected to transcription service'}
                          {connectionStatus === 'error' && 'Failed to connect to transcription service'}
                        </span>
                      </div>
                    )}
                  </form>

                  {/* Live Transcript Display */}
                  {(isRecording || liveTranscript) && (
                    <div className="mt-6">
                      <h3 className="text-white font-semibold mb-3">Live Transcript</h3>
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10 min-h-[100px] max-h-[300px] overflow-y-auto">
                        <p className="text-slate-300 leading-relaxed">
                          {liveTranscript || (isRecording ? "Listening..." : "No transcript yet")}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="upload" className="mt-8">
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Upload className="h-5 w-5 text-purple-400" />
                  Upload Audio File
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Upload a recorded meeting or audio file for AI-powered transcription
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleFileUpload} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="audio-file" className="text-white">Audio File</Label>
                    <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-purple-400 transition-colors">
                      <input
                        id="audio-file"
                        type="file"
                        accept="audio/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <label htmlFor="audio-file" className="cursor-pointer flex flex-col items-center gap-4">
                        <Upload className="h-12 w-12 text-slate-400" />
                        <div>
                          <p className="text-white font-medium">
                            {selectedFile ? selectedFile.name : 'Click to upload audio file'}
                          </p>
                          <p className="text-sm text-slate-400">
                            Supports MP3, WAV, M4A, FLAC, and other audio formats
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !selectedFile}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
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
          <Card className="mt-8 bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Transcription Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transcriptSegments.length > 0 ? (
                  // Show structured transcript segments
                  transcriptSegments.map((segment, index) => (
                    <div key={segment.id || index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-purple-400">
                            {segment.speaker}
                          </span>
                          <span className="text-xs text-slate-400">{segment.timestamp}</span>
                        </div>
                        <span className="text-xs text-green-400">
                          {Math.round(segment.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{segment.text}</p>
                    </div>
                  ))
                ) : (
                  // Show basic transcription results
                  transcriptionResults.map((text, index) => (
                    <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <p className="text-slate-300 leading-relaxed">{text}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={handleSaveTranscription}
                  disabled={saving}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
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
                  className="border-white/30 hover:bg-white/10 text-slate-950"
                >
                  Copy All
                </Button>
                <Button
                  onClick={() => {
                    setTranscriptionResults([]);
                    setTranscriptSegments([]);
                  }}
                  variant="outline"
                  className="border-white/30 hover:bg-white/10 text-slate-950"
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
