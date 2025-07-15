import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, Save, Mic, Square, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
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
import AudioRecorder from '@/components/AudioRecorder';
import { useChunkedTranscription, ChunkTranscript } from "@/hooks/useChunkedTranscription";
import { Badge } from '@/components/ui/badge';
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
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [loading, setLoading] = useState(false);
  const [audioCaptureTitle, setAudioCaptureTitle] = useState('');
  const [virtualAudioTitle, setVirtualAudioTitle] = useState('');
  const [microphonePermError, setMicrophonePermError] = useState<string | null>(null);
  const [speakerSegments, setSpeakerSegments] = useState<TranscriptSegment[]>([]);
  const [selectedVirtualDevice, setSelectedVirtualDevice] = useState<VirtualAudioDevice | null>(null);
  const [virtualAudioStream, setVirtualAudioStream] = useState<MediaStream | null>(null);
  const [virtualAudioTranscripts, setVirtualAudioTranscripts] = useState<ChunkTranscript[]>([]);
  const [isVirtualRecording, setIsVirtualRecording] = useState(false);
  const [virtualMediaRecorderError, setVirtualMediaRecorderError] = useState<string | null>(null);
  const [virtualAudioDebug, setVirtualAudioDebug] = useState<any>(null);
  const [meetingMode, setMeetingMode] = useState<'audio' | 'virtual' | 'upload'>('audio');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { user, session } = useAuth();
  const { toast } = useToast();

  const authToken = session?.access_token;

  const {
    isRecording: isVirtRecActive,
    isProcessing: isVirtRecProcessing,
    error: virtRecError,
    chunks: virtTranscripts,
    combinedTranscript,
    finalTranscript,
    stop: stopVirtRecording,
    reset: resetVirtRecording,
  } = useChunkedTranscription({
    stream: virtualAudioStream,
    isActive: isVirtualRecording,
    authToken,
    onTranscriptsUpdate: setVirtualAudioTranscripts,
  });

  useEffect(() => {
    setVirtualMediaRecorderError(null);
    setIsVirtualRecording(false);
    setVirtualAudioTranscripts([]);
    setVirtualAudioTitle('');
    resetVirtRecording();
    if (virtualAudioStream) {
      console.log("[VirtualAudio] New stream attached:", virtualAudioStream);
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

  const handleVirtualDeviceSelected = (device: VirtualAudioDevice) => {
    setSelectedVirtualDevice(device);
    console.log('Selected virtual audio device:', device);
  };

  const handleVirtualAudioSetupComplete = (stream: MediaStream) => {
    console.log("[VirtualAudio] Setup complete. Stream details:", {
      active: stream?.active,
      trackCount: stream?.getTracks().length,
      tracks: stream?.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        readyState: t.readyState,
        muted: (t as any)?.muted,
        id: t.id
      })),
      constraints: stream?.getAudioTracks()[0]?.getSettings?.(),
    });
    setVirtualAudioStream(stream);
    toast({
      title: "Virtual Audio Ready",
      description: "Ready to capture meeting audio for transcription",
    });
    if (!stream) {
      setVirtualMediaRecorderError("MediaStream is null after setup!");
      console.error("[VirtualAudio] Setup returned a null stream.");
    }
  };

  const toggleVirtualAudioTranscription = async () => {
    console.log("[VirtualAudio] toggleVirtualAudioTranscription called, isVirtualRecording:", isVirtualRecording);

    if (isVirtualRecording) {
      const final = await stopVirtRecording();
      setIsVirtualRecording(false);
      console.log("[VirtualAudio] Stopped transcription, finalTranscript:", final);
      if (final) {
        setTranscriptionResults([final]);
      } else {
        console.warn("[VirtualAudio] No final transcript available");
        toast({
          title: "No Transcript",
          description: "No valid transcription was generated.",
          variant: "destructive",
        });
      }
      toast({
        title: "Virtual Audio Stopped",
        description: "Transcription has been stopped.",
      });
      return;
    }

    if (!virtualAudioStream) {
      setVirtualMediaRecorderError("Virtual audio stream unavailable!");
      toast({
        title: "Audio Device Error",
        description: "No virtual audio stream is active. Please select and set up a device first.",
        variant: "destructive",
      });
      console.error("[VirtualAudio] No virtual audio stream available");
      return;
    }

    if (!virtualAudioTitle.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a title for your transcription.",
        variant: "destructive",
      });
      console.error("[VirtualAudio] No title provided");
      return;
    }

    const tracks = virtualAudioStream.getTracks();
    if (!tracks.length) {
      setVirtualMediaRecorderError("No media tracks present in virtual audio stream.");
      toast({
        title: "Audio Device Error",
        description: "No audio tracks found on selected virtual stream.",
        variant: "destructive",
      });
      console.error("[VirtualAudio] No tracks in virtual audio stream");
      return;
    }

    const audioTrack = virtualAudioStream.getAudioTracks()[0];
    if (!audioTrack || audioTrack.readyState !== 'live') {
      setVirtualMediaRecorderError("No active audio track found in stream!");
      toast({
        title: "Audio Track Error",
        description: "The selected audio device is not providing an active audio track.",
        variant: "destructive",
      });
      console.error("[VirtualAudio] No active audio track:", audioTrack);
      return;
    }

    setVirtualMediaRecorderError(null);
    setVirtualAudioTranscripts([]);
    resetVirtRecording();
    setTranscriptionResults([]);
    setIsVirtualRecording(true);
    console.log("[VirtualAudio] Started transcription");
    toast({
      title: "Virtual Audio Started",
      description: "Capturing system audio for transcription.",
    });
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
          'Authorization': `Bearer ${authToken}`
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
    console.log("Trying to save transcription result");
    const transcriptToSave = speakerSegments.length > 0 
      ? speakerSegments.map(s => s.text).join(' ')
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
          title: meetingMode === 'audio'
            ? audioCaptureTitle
            : meetingMode === 'virtual'
            ? virtualAudioTitle
            : selectedFile?.name || 'Uploaded Audio Transcription',
          content: transcriptToSave,
          source_type: selectedFile ? 'upload' : meetingMode === 'audio' ? 'audio_capture' : 'meeting',
          audio_url: null,
          meeting_url: null,
          duration: null
        });

      if (error) throw error;

      toast({
        title: "Transcription Saved",
        description: "Your transcription has been saved to your notes."
      });

      setTranscriptionResults([]);
      setSpeakerSegments([]);
      setSelectedFile(null);
      setAudioCaptureTitle('');
      setVirtualAudioTitle('');
      setLiveTranscript('');
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
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'connecting':
        return <AlertCircle className="h-4 w-4 text-yellow-400 animate-pulse" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black">
      <header className="px-4 md:px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link to="/notes" className="text-white hover:text-purple-400 transition-colors">
              <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
            </Link>
            <div className="flex items-center space-x-2">
              <img src="/lovable-uploads/a5a042c4-e054-4df2-b3b5-8ae8386c5f2b.png" alt="NeuroNotes" className="h-9 w-auto sm:h-12" />
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
                    onSubmit={(e) => e.preventDefault()}
                    className="space-y-5 md:space-y-6"
                  >
                    <div className="space-y-2 mb-7">
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
                  </form>
                  <AudioRecorder
                    onTranscription={(chunkText) => {
                      setLiveTranscript(prev => prev + (chunkText ? "\n" + chunkText : ""));
                    }}
                    onFinalized={(fullText, segmentsArr) => {
                      const newSegments = segmentsArr.map((seg, index) => ({
                        id: `seg-${index}`,
                        timestamp: new Date().toISOString(),
                        speaker: seg.speaker || 'Unknown',
                        text: seg.text,
                        confidence: seg.confidence
                      }));
                      setSpeakerSegments(newSegments);
                      setTranscriptionResults([fullText]);
                      setLiveTranscript('');
                    }}
                    isRecording={isRecording}
                    setIsRecording={setIsRecording}
                    disabled={!audioCaptureTitle.trim()}
                  />
                  {isRecording && (
                    <div className="mt-4 md:mt-6">
                      <h3 className="text-white font-semibold mb-2 md:mb-3">Live Transcript</h3>
                      <div className="bg-white/5 rounded-lg p-3 md:p-4 border border-white/10 min-h-[70px] max-h-52 md:max-h-[300px] overflow-y-auto">
                        <p className="text-slate-300 leading-relaxed text-xs md:text-base break-words whitespace-pre-line">
                          {liveTranscript || "Listening..."}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="virtual" className="mt-6 md:mt-8 space-y-4 md:space-y-6">
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <CardTitle className="text-white text-lg md:text-xl">Virtual Audio Mode</CardTitle>
                  <CardDescription className="text-slate-300 text-sm md:text-base">
                    Capture audio from virtual meetings or system audio. Select a device, enter a title, and start transcription.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <VirtualAudioSetup
                    onDeviceSelected={handleVirtualDeviceSelected}
                    onSetupComplete={handleVirtualAudioSetupComplete}
                  />
                  {virtualMediaRecorderError && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      <AlertDescription>{virtualMediaRecorderError}</AlertDescription>
                    </Alert>
                  )}
                  {virtualAudioDebug && (
                    <div className="mb-4 rounded bg-slate-900/90 border border-slate-700 px-4 py-3 text-xs text-slate-200">
                      <span className="font-bold text-purple-400 mr-2">Virtual Audio Debug</span>
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
                    </div>
                  )}
                  {virtualAudioStream && (
                    <div className="space-y-4">
                      <div className="space-y-2 mb-4">
                        <Label htmlFor="virtual-note-title" className="text-white">Title</Label>
                        <Input
                          id="virtual-note-title"
                          type="text"
                          placeholder="Enter a descriptive note title"
                          value={virtualAudioTitle}
                          onChange={(e) => setVirtualAudioTitle(e.target.value)}
                          className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                          required
                          disabled={isVirtualRecording}
                        />
                        <p className="text-xs md:text-sm text-slate-400">
                          The title will be used to save your transcription note.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={toggleVirtualAudioTranscription}
                          variant={isVirtualRecording ? "destructive" : "default"}
                          size="sm"
                          className={isVirtualRecording ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
                          disabled={isVirtRecProcessing || !virtualAudioStream || !virtualAudioTitle.trim()}
                        >
                          {isVirtualRecording ? (
                            <>
                              <Square className="h-4 w-4 mr-2" />
                              Stop Transcription
                            </>
                          ) : (
                            <>
                              <Mic className="h-4 w-4 mr-2" />
                              Start Transcription
                            </>
                          )}
                        </Button>
                        {isVirtRecProcessing && (
                          <Badge className="bg-purple-800 text-white">Processing…</Badge>
                        )}
                      </div>
                      {virtRecError && (
                        <Alert variant="destructive" className="mt-3">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          <AlertDescription>{virtRecError}</AlertDescription>
                        </Alert>
                      )}
                      <div className="mt-4">
                        <h3 className="text-white font-semibold mb-2 md:mb-3">Live Transcript</h3>
                        <div className="bg-white/5 rounded-lg p-3 md:p-4 border border-white/10 min-h-[70px] max-h-52 md:max-h-[300px] overflow-y-auto">
                          <p className="text-slate-300 leading-relaxed text-xs md:text-base break-words whitespace-pre-line">
                            {combinedTranscript || (isVirtualRecording ? "Listening..." : "No transcript yet. Start to capture system audio.")}
                          </p>
                        </div>
                      </div>
                      {combinedTranscript && (
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setVirtualAudioTranscripts([]);
                              resetVirtRecording();
                            }}
                            variant="outline"
                            size="sm"
                            className="border-white/30 text-black"
                          >
                            Clear
                          </Button>
                          <Button
                            onClick={() => {
                              navigator.clipboard.writeText(combinedTranscript);
                              toast({
                                title: "Copied",
                                description: "Transcription copied to clipboard.",
                              });
                            }}
                            variant="outline"
                            size="sm"
                            className="border-white/30 text-black"
                          >
                            Copy All
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

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

        {(transcriptionResults.length > 0 || speakerSegments.length > 0) && (
          <Card className="mt-7 md:mt-8 bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-white text-lg md:text-xl">Transcription Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 md:space-y-4">
                {speakerSegments.length > 0 ? (
                  speakerSegments.map((segment, index) => (
                    <div key={segment.id} className="bg-white/5 rounded-lg p-3 md:p-4 border border-white/10 overflow-x-auto">
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
                    const transcriptText = speakerSegments.length > 0
                      ? speakerSegments.map(s => `[${s.speaker}]: ${s.text}`).join(' ')
                      : transcriptionResults.join(' ');
                    navigator.clipboard.writeText(transcriptText);
                    toast({
                      title: "Copied",
                      description: "Transcription copied to clipboard.",
                    });
                  }}
                  variant="outline"
                  className="bg-white/10 border-white/30 hover:bg-white/50 text-white px-3 py-2"
                >
                  Copy All
                </Button>
                <Button
                  onClick={() => {
                    setTranscriptionResults([]);
                    setSpeakerSegments([]);
                    setVirtualAudioTranscripts([]);
                    resetVirtRecording();
                  }}
                  variant="outline"
                  className="bg-white/10 border-white/30 hover:bg-white/50 text-white px-3 py-2"
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