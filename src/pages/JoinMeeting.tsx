
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brain, ExternalLink, Upload, Play, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const JoinMeeting = () => {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleJoinMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingUrl.trim()) {
      toast({
        title: "Meeting URL Required",
        description: "Please enter a valid meeting URL",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement meeting joining logic with Playwright
      toast({
        title: "Meeting Assistant Starting",
        description: "Your AI assistant will join the meeting shortly.",
      });
      
      // Navigate to dashboard or a monitoring page
      navigate('/dashboard');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start meeting assistant. Please try again.",
        variant: "destructive",
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
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement audio file upload and transcription with Deepgram
      toast({
        title: "Upload Started",
        description: "Your audio file is being processed for transcription.",
      });
      
      // Navigate to dashboard or transcript editor
      navigate('/dashboard');
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload audio file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check if it's an audio file
      if (file.type.startsWith('audio/')) {
        setSelectedFile(file);
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please select an audio file (mp3, wav, m4a, etc.)",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black">
      {/* Header */}
      <header className="px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="text-white hover:text-purple-400 transition-colors">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div className="flex items-center space-x-2">
              <Brain className="h-8 w-8 text-purple-400" />
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

          <TabsContent value="meeting" className="mt-8">
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <ExternalLink className="h-5 w-5 text-purple-400" />
                  Join Live Meeting
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Enter the meeting URL and our AI assistant will join to provide real-time transcription
                </CardDescription>
              </CardHeader>
              <CardContent>
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

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                  >
                    {loading ? (
                      'Starting Assistant...'
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Start Meeting Assistant
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
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
                      <label
                        htmlFor="audio-file"
                        className="cursor-pointer flex flex-col items-center gap-4"
                      >
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
                    {loading ? (
                      'Processing...'
                    ) : (
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
      </div>
    </div>
  );
};

export default JoinMeeting;
