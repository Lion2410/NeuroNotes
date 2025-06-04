
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Save, Download, Share, Users, Edit3, FileText, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

const TranscriptEditor = () => {
  const [transcript, setTranscript] = useState(`[00:00:15] John Smith: Good morning everyone, thanks for joining today's weekly standup. Let's start with our progress updates.

[00:00:25] Sarah Johnson: I'll go first. This week I completed the user authentication module and started working on the dashboard components. I'm about 80% done with the task and should finish by tomorrow.

[00:00:45] Mike Chen: Great work Sarah. On my end, I've been focusing on the API integration. We've successfully connected to the third-party services and I'm now working on error handling. Should be ready for testing by Friday.

[00:01:10] John Smith: Excellent progress team. Any blockers or concerns we should address?

[00:01:15] Sarah Johnson: Actually yes, I have a question about the color scheme for the new components. Can we schedule a quick design review?

[00:01:25] John Smith: Absolutely. Let's set that up for this afternoon. Mike, anything from your side?

[00:01:35] Mike Chen: No blockers here. The API documentation is well-structured so integration has been smooth.

[00:01:45] John Smith: Perfect. Let's wrap up with action items for next week...`);

  const [isEditing, setIsEditing] = useState(false);

  const meetingInfo = {
    title: 'Weekly Team Standup',
    date: '2024-06-04',
    duration: '32 min',
    participants: ['John Smith', 'Sarah Johnson', 'Mike Chen'],
    status: 'completed'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black">
      {/* Header */}
      <header className="px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <Bot className="h-8 w-8 text-purple-400" />
              <span className="text-2xl font-bold text-white">NeuroNotes</span>
            </Link>
            <span className="text-slate-400">/</span>
            <span className="text-white font-medium">Transcript Editor</span>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              <Users className="h-4 w-4 mr-2" />
              Collaborators
            </Button>
            <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
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
                    <Button 
                      onClick={() => setIsEditing(!isEditing)}
                      variant="outline" 
                      className="border-white/30 text-white hover:bg-white/10"
                    >
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

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4">
              <Button className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white">
                Generate Summary
              </Button>
              <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
                <Download className="h-4 w-4 mr-2" />
                Export Transcript
              </Button>
              <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
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
                  <div className="text-white text-lg font-semibold">1,247</div>
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
