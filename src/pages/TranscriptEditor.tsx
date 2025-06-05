
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Download, Share, Users, Edit3, FileText, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const TranscriptEditor = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [transcript, setTranscript] = useState(`[00:00:15] John Smith: Good morning everyone, thanks for joining today's weekly standup. Let's start with our progress updates.

[00:00:25] Sarah Johnson: I'll go first. This week I completed the user authentication module and started working on the dashboard components. I'm about 80% done with the task and should finish by tomorrow.

[00:00:45] Mike Chen: Great work Sarah. On my end, I've been focusing on the API integration. We've successfully connected to the third-party services and I'm now working on error handling. Should be ready for testing by Friday.

[00:01:10] John Smith: Excellent progress team. Any blockers or concerns we should address?

[00:01:15] Sarah Johnson: Actually yes, I have a question about the color scheme for the new components. Can we schedule a quick design review?

[00:01:25] John Smith: Absolutely. Let's set that up for this afternoon. Mike, anything from your side?

[00:01:35] Mike Chen: No blockers here. The API documentation is well-structured so integration has been smooth.

[00:01:45] John Smith: Perfect. Let's wrap up with action items for next week...`);
  
  const [isEditing, setIsEditing] = useState(false);
  const [summary, setSummary] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const meetingInfo = {
    title: 'Weekly Team Standup',
    date: '2024-06-04',
    duration: '32 min',
    participants: ['John Smith', 'Sarah Johnson', 'Mike Chen'],
    status: 'completed'
  };

  const handleSave = () => {
    toast({
      title: "Transcript Saved",
      description: "Your changes have been saved successfully.",
    });
  };

  const handleExport = () => {
    const element = document.createElement('a');
    const file = new Blob([transcript], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${meetingInfo.title.replace(/\s+/g, '_')}_transcript.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    
    toast({
      title: "Export Complete",
      description: "Transcript has been downloaded successfully.",
    });
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/transcript/${id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link Copied",
        description: "Shareable link has been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        title: "Share Failed",
        description: "Failed to copy share link. Please try again.",
        variant: "destructive",
      });
    }
  };

  const generateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      // Simulate AI summary generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const generatedSummary = `Meeting Summary:

Key Discussion Points:
• Team progress updates on authentication module and API integration
• Sarah Johnson completed user authentication module (80% done, finishing tomorrow)
• Mike Chen working on API integration and error handling (ready for testing by Friday)
• Need for design review on color scheme for new components

Action Items:
• Schedule design review for this afternoon (Sarah & team)
• Complete authentication module by tomorrow (Sarah)
• Finish API error handling by Friday (Mike)
• Prepare for testing phase next week

Participants: John Smith (facilitator), Sarah Johnson (Developer), Mike Chen (Developer)
Duration: 32 minutes
Status: All tasks on track, no major blockers identified`;

      setSummary(generatedSummary);
      toast({
        title: "Summary Generated",
        description: "AI-powered meeting summary has been created.",
      });
    } catch (error) {
      toast({
        title: "Summary Failed",
        description: "Failed to generate summary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

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
            <Button onClick={handleSave} variant="outline" className="border-white/30 hover:bg-white/10 text-white">
              <Save className="h-4 w-4 mr-2" />
              Save
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
                    <CardTitle className="text-white text-2xl">{meetingInfo.title}</CardTitle>
                    <div className="flex items-center gap-4 mt-2 text-slate-300">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {meetingInfo.date}
                      </span>
                      <span>{meetingInfo.duration}</span>
                      <Badge variant="default" className="bg-green-600">
                        {meetingInfo.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => setIsEditing(!isEditing)} variant="outline" className="border-white/30 hover:bg-white/10 text-white">
                      <Edit3 className="h-4 w-4 mr-2" />
                      {isEditing ? 'View Mode' : 'Edit Mode'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Transcript Editor */}
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Meeting Transcript
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            {/* Summary Section */}
            {summary && (
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-yellow-400" />
                    AI-Generated Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-white/5 border border-white/20 rounded-md p-4">
                    <pre className="text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                      {summary}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4">
              <Button 
                onClick={generateSummary}
                disabled={isGeneratingSummary}
                className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isGeneratingSummary ? 'Generating...' : 'Generate Summary'}
              </Button>
              <Button onClick={handleExport} variant="outline" className="border-white/30 hover:bg-white/10 text-white">
                <Download className="h-4 w-4 mr-2" />
                Export Transcript
              </Button>
              <Button onClick={handleShare} variant="outline" className="border-white/30 hover:bg-white/10 text-white">
                <Share className="h-4 w-4 mr-2" />
                Share Link
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Participants */}
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Participants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {meetingInfo.participants.map((participant, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-teal-500 to-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {participant.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <span className="text-white text-sm">{participant}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

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
                  <div className="text-slate-300 text-sm">Speaking Time</div>
                  <div className="text-white text-lg font-semibold">28 min</div>
                </div>
                <div>
                  <div className="text-slate-300 text-sm">Confidence Score</div>
                  <div className="text-white text-lg font-semibold">94%</div>
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
                    <span className="text-white">You</span> edited transcript
                    <div className="text-xs text-slate-400">2 minutes ago</div>
                  </div>
                  <div className="text-slate-300">
                    <span className="text-white">Sarah J.</span> added comment
                    <div className="text-xs text-slate-400">15 minutes ago</div>
                  </div>
                  <div className="text-slate-300">
                    <span className="text-white">Bot</span> completed transcription
                    <div className="text-xs text-slate-400">32 minutes ago</div>
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
