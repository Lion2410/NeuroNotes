
import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Download, Share, Users, Edit3, FileText, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TranscriptionData {
  id: string;
  title: string;
  content: string;
  summary?: string;
  created_at: string;
  duration?: number;
  source_type: string;
  meeting_url?: string;
}

const TranscriptEditor = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const { user, refreshSession } = useAuth();
  const [transcriptionData, setTranscriptionData] = useState<TranscriptionData | null>(null);
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('transcript');

  useEffect(() => {
    if (user && id) {
      fetchTranscription();
    }
  }, [user, id]);

  const handleWithRetry = async (operation: () => Promise<any>, operationName: string) => {
    try {
      return await operation();
    } catch (error: any) {
      if (error.message?.includes('expired') || error.message?.includes('JWT')) {
        console.log(`${operationName} failed, refreshing session and retrying...`);
        await refreshSession();
        return await operation();
      }
      throw error;
    }
  };

  const fetchTranscription = async () => {
    try {
      const { data, error } = await supabase
        .from('transcriptions')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setTranscriptionData(data);
        setTranscript(data.content || '');
        setSummary(data.summary || '');
      }
    } catch (error: any) {
      console.error('Error fetching transcription:', error);
      toast({
        title: "Error",
        description: "Failed to load transcription. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await handleWithRetry(async () => {
        const { error } = await supabase
          .from('transcriptions')
          .update({
            content: transcript,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .eq('user_id', user?.id);

        if (error) {
          throw error;
        }
      }, 'Transcript save');

      toast({
        title: "Transcript Saved",
        description: "Your changes have been saved successfully."
      });
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save transcript. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    const element = document.createElement('a');
    const file = new Blob([transcript], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${transcriptionData?.title?.replace(/\s+/g, '_') || 'transcript'}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    
    toast({
      title: "Export Complete",
      description: "Transcript has been downloaded successfully."
    });
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/transcript/${id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link Copied",
        description: "Shareable link has been copied to your clipboard."
      });
    } catch (error) {
      toast({
        title: "Share Failed",
        description: "Failed to copy share link. Please try again.",
        variant: "destructive"
      });
    }
  };

  const generateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      // Simulate AI summary generation with the actual transcript content
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const lines = transcript.split('\n').filter(line => line.trim());
      const speakers = new Set<string>();
      const keyPoints: string[] = [];
      
      // Extract speakers and key information
      lines.forEach(line => {
        const speakerMatch = line.match(/\[[\d:]+\]\s*([^:]+):/);
        if (speakerMatch) {
          speakers.add(speakerMatch[1].trim());
        }
        
        // Look for important keywords
        if (line.toLowerCase().includes('action') || 
            line.toLowerCase().includes('decision') || 
            line.toLowerCase().includes('important') ||
            line.toLowerCase().includes('deadline') ||
            line.toLowerCase().includes('next week') ||
            line.toLowerCase().includes('follow up')) {
          keyPoints.push(line.replace(/\[[\d:]+\]\s*[^:]+:\s*/, '').trim());
        }
      });

      const generatedSummary = `Meeting Summary:

Key Discussion Points:
${keyPoints.length > 0 ? keyPoints.map(point => `• ${point}`).join('\n') : '• General discussion and updates'}

Participants: ${Array.from(speakers).join(', ') || 'Multiple participants'}
Duration: ${transcriptionData?.duration ? `${transcriptionData.duration} minutes` : 'Unknown'}
Date: ${transcriptionData?.created_at ? new Date(transcriptionData.created_at).toLocaleDateString() : 'Unknown'}

Status: Meeting completed successfully`;

      setSummary(generatedSummary);

      // Save summary to database
      await handleWithRetry(async () => {
        const { error } = await supabase
          .from('transcriptions')
          .update({
            summary: generatedSummary,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .eq('user_id', user?.id);

        if (error) {
          throw error;
        }
      }, 'Summary save');

      toast({
        title: "Summary Generated",
        description: "AI-powered meeting summary has been created and saved."
      });
    } catch (error: any) {
      console.error('Summary generation error:', error);
      toast({
        title: "Summary Failed",
        description: "Failed to generate summary. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleSummaryTabClick = () => {
    setActiveTab('summary');
    if (!summary && transcript) {
      generateSummary();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-white">Loading transcription...</div>
      </div>
    );
  }

  if (!transcriptionData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-white">Transcription not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black">
      {/* Header */}
      <header className="px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="flex items-center space-x-2 text-white hover:text-purple-400 transition-colors">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div className="flex items-center space-x-2">
              <img src="/lovable-uploads/e8e442bd-846b-4e60-b16a-3043d419243f.png" alt="NeuroNotes" className="h-8 w-auto" />
              <span className="text-2xl font-bold text-white">NeuroNotes</span>
            </div>
            <span className="text-slate-400">/</span>
            <span className="text-white font-medium">Transcript Editor</span>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              <Users className="h-4 w-4 mr-2" />
              Collaborators
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              variant="outline" 
              className="border-white/30 hover:bg-white/10 text-slate-950"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Meeting Info */}
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white text-2xl">{transcriptionData.title}</CardTitle>
                    <div className="flex items-center gap-4 mt-2 text-slate-300">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {new Date(transcriptionData.created_at).toLocaleDateString()}
                      </span>
                      {transcriptionData.duration && (
                        <span>{transcriptionData.duration} min</span>
                      )}
                      <Badge variant="default" className="bg-green-600">
                        {transcriptionData.source_type}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setIsEditing(!isEditing)}
                      variant="outline"
                      className="border-white/30 hover:bg-white/10 text-slate-950"
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      {isEditing ? 'View Mode' : 'Edit Mode'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Transcript/Summary Tabs */}
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="bg-white/10 border-white/20">
                    <TabsTrigger value="transcript" className="text-white data-[state=active]:bg-purple-600">
                      <FileText className="h-4 w-4 mr-2" />
                      Transcript
                    </TabsTrigger>
                    <TabsTrigger value="summary" className="text-white data-[state=active]:bg-purple-600" onClick={handleSummaryTabClick}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Summary
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="transcript" className="mt-6">
                    {isEditing ? (
                      <Textarea
                        value={transcript}
                        onChange={(e) => setTranscript(e.target.value)}
                        className="min-h-[500px] bg-white/5 border-white/20 text-white placeholder:text-slate-400 resize-none"
                        placeholder="Transcript content..."
                      />
                    ) : (
                      <div className="bg-white/5 border border-white/20 rounded-md p-4 min-h-[500px]">
                        <pre className="text-white whitespace-pre-wrap font-mono text-sm leading-relaxed">
                          {transcript}
                        </pre>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="summary" className="mt-6">
                    {isGeneratingSummary ? (
                      <div className="bg-white/5 border border-white/20 rounded-md p-4 min-h-[300px] flex items-center justify-center">
                        <div className="text-center text-white">
                          <Sparkles className="h-8 w-8 animate-spin mx-auto mb-4 text-yellow-400" />
                          <p>Generating AI summary...</p>
                        </div>
                      </div>
                    ) : summary ? (
                      <div className="bg-white/5 border border-white/20 rounded-md p-4 min-h-[300px]">
                        <pre className="text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                          {summary}
                        </pre>
                      </div>
                    ) : (
                      <div className="bg-white/5 border border-white/20 rounded-md p-4 min-h-[300px] flex items-center justify-center">
                        <div className="text-center text-white">
                          <Sparkles className="h-12 w-12 mx-auto mb-4 text-yellow-400" />
                          <p className="mb-4">No summary available yet.</p>
                          <Button
                            onClick={generateSummary}
                            className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white"
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate Summary
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardHeader>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4">
              {!summary && activeTab === 'transcript' && (
                <Button
                  onClick={generateSummary}
                  disabled={isGeneratingSummary}
                  className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isGeneratingSummary ? 'Generating...' : 'Generate Summary'}
                </Button>
              )}
              <Button
                onClick={handleExport}
                variant="outline"
                className="border-white/30 hover:bg-white/10 text-slate-950"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Transcript
              </Button>
              <Button
                onClick={handleShare}
                variant="outline"
                className="border-white/30 hover:bg-white/10 text-slate-950"
              >
                <Share className="h-4 w-4 mr-2" />
                Share Link
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Meeting Statistics */}
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-slate-300 text-sm">Word Count</div>
                  <div className="text-white text-lg font-semibold">{transcript.split(' ').length}</div>
                </div>
                <div>
                  <div className="text-slate-300 text-sm">Duration</div>
                  <div className="text-white text-lg font-semibold">
                    {transcriptionData.duration ? `${transcriptionData.duration} min` : 'Unknown'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-300 text-sm">Source</div>
                  <div className="text-white text-lg font-semibold capitalize">
                    {transcriptionData.source_type.replace('_', ' ')}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="text-slate-300">
                    <span className="text-white">You</span> viewed transcript
                    <div className="text-xs text-slate-400">Just now</div>
                  </div>
                  <div className="text-slate-300">
                    <span className="text-white">System</span> created transcript
                    <div className="text-xs text-slate-400">
                      {new Date(transcriptionData.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptEditor;
