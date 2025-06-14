
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Upload, Play, Save, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import RealTimeTranscriber from '@/components/RealTimeTranscriber';

const JoinMeeting = () => {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transcriptionResults, setTranscriptionResults] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [meetingBotStatus, setMeetingBotStatus] = useState<'idle' | 'starting' | 'success' | 'error'>('idle');
  
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

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
    if (!transcriptionResults.length || !user) {
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
          title: selectedFile?.name || 'Meeting Transcription',
          content: transcriptionResults.join(' '),
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
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'starting':
        return <AlertCircle className="h-4 w-4 text-yellow-600 animate-pulse" />;
      default:
        return null;
    }
  };

  const handleTranscriptionSaved = (transcriptionId: string) => {
    // Optionally navigate to the notes page or show the saved transcription
    toast({
      title: "Success",
      description: "You can find your saved transcription in the Notes tab."
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/notes" className="text-gray-600 hover:text-blue-600 transition-colors">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div className="flex items-center space-x-2">
              <img src="/lovable-uploads/2d11ec38-9fc4-4af5-9224-4b5b20a91803.png" alt="NeuroNotes" className="h-12 w-auto" />
              <span className="text-2xl font-bold text-gray-900">NeuroNotes</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-700">Welcome, {user?.email}</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Start Transcription</h1>
          <p className="text-xl text-gray-600">Join a live meeting, upload audio, or use real-time recording</p>
        </div>

        <Tabs defaultValue="realtime" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white border border-gray-200">
            <TabsTrigger value="realtime" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Real-Time Recording
            </TabsTrigger>
            <TabsTrigger value="meeting" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Live Meeting
            </TabsTrigger>
            <TabsTrigger value="upload" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Upload Audio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="realtime" className="mt-8">
            <RealTimeTranscriber onTranscriptionSaved={handleTranscriptionSaved} />
          </TabsContent>

          <TabsContent value="meeting" className="mt-8">
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <ExternalLink className="h-5 w-5 text-blue-600" />
                  Join Live Meeting
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Enter the meeting URL and our bot will automatically join and transcribe the meeting
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Status Alerts */}
                {meetingBotStatus === 'success' && (
                  <Alert className="mb-4 border-green-600 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                      Meeting bot successfully started and joined the meeting.
                    </AlertDescription>
                  </Alert>
                )}
                
                {meetingBotStatus === 'error' && (
                  <Alert className="mb-4 border-red-600 bg-red-50">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-700">
                      Failed to start meeting bot. Please check your meeting URL and try again.
                    </AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleJoinMeeting} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="meeting-url" className="text-gray-900">Meeting URL</Label>
                    <Input
                      id="meeting-url"
                      type="url"
                      placeholder="https://meet.google.com/abc-defg-hij or https://zoom.us/j/..."
                      value={meetingUrl}
                      onChange={(e) => setMeetingUrl(e.target.value)}
                      className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                      required
                    />
                    <p className="text-sm text-gray-500">
                      Supports Google Meet, Zoom, Microsoft Teams, and other popular platforms
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
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
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upload" className="mt-8">
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <Upload className="h-5 w-5 text-blue-600" />
                  Upload Audio File
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Upload a recorded meeting or audio file for AI-powered transcription
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleFileUpload} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="audio-file" className="text-gray-900">Audio File</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                      <input
                        id="audio-file"
                        type="file"
                        accept="audio/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <label htmlFor="audio-file" className="cursor-pointer flex flex-col items-center gap-4">
                        <Upload className="h-12 w-12 text-gray-400" />
                        <div>
                          <p className="text-gray-900 font-medium">
                            {selectedFile ? selectedFile.name : 'Click to upload audio file'}
                          </p>
                          <p className="text-sm text-gray-500">
                            Supports MP3, WAV, M4A, FLAC, and other audio formats
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !selectedFile}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
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
        {transcriptionResults.length > 0 && (
          <Card className="mt-8 bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Transcription Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transcriptionResults.map((text, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={handleSaveTranscription}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {saving ? 'Saving...' : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save to Notes
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => navigator.clipboard.writeText(transcriptionResults.join(' '))}
                  variant="outline"
                  className="border-gray-300 hover:bg-gray-50"
                >
                  Copy All
                </Button>
                <Button
                  onClick={() => setTranscriptionResults([])}
                  variant="outline"
                  className="border-gray-300 hover:bg-gray-50"
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
