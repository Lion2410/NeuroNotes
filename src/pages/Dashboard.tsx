
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot, Plus, Search, Filter, Play, Square, Users, FileText, Download, Share, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

const Dashboard = () => {
  const [activeBot, setActiveBot] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Mock data for meetings
  const meetings = [
    {
      id: 1,
      title: 'Weekly Team Standup',
      date: '2024-06-04',
      duration: '32 min',
      status: 'completed',
      transcript: true,
      summary: true,
      participants: 5
    },
    {
      id: 2,
      title: 'Product Strategy Review',
      date: '2024-06-03',
      duration: '1h 15min',
      status: 'completed',
      transcript: true,
      summary: true,
      participants: 8
    },
    {
      id: 3,
      title: 'Client Call - Project Alpha',
      date: '2024-06-02',
      duration: '45 min',
      status: 'processing',
      transcript: true,
      summary: false,
      participants: 3
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black">
      {/* Header */}
      <header className="px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="h-8 w-8 text-purple-400" />
            <span className="text-2xl font-bold text-white">NeuroNotes</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-white">Welcome, {user?.email}</span>
            <Button
              onClick={handleSignOut}
              variant="ghost"
              className="text-white hover:bg-white/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome back!</h1>
          <p className="text-slate-300">Manage your meeting transcriptions and collaborate with your team.</p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Bot className="h-5 w-5 text-purple-400" />
                  Bot Status
                </CardTitle>
                <Badge variant={activeBot ? "default" : "secondary"} className={activeBot ? "bg-green-600" : "bg-slate-600"}>
                  {activeBot ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 mb-4">
                {activeBot ? "Bot is currently recording a meeting" : "Start a new meeting bot"}
              </p>
              <Button 
                onClick={() => setActiveBot(!activeBot)}
                className={`w-full ${activeBot ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'} text-white`}
              >
                {activeBot ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Stop Bot
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start New Bot
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-400" />
                Total Meetings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-2">24</div>
              <p className="text-slate-300">3 this week</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-400" />
                Team Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-2">8</div>
              <p className="text-slate-300">Active collaborators</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Meetings */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Recent Meetings</h2>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search meetings..."
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-slate-400 w-64"
                />
              </div>
              <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {meetings.map((meeting) => (
              <Card key={meeting.id} className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <h3 className="text-lg font-semibold text-white">{meeting.title}</h3>
                        <Badge variant={meeting.status === 'completed' ? 'default' : 'secondary'} 
                               className={meeting.status === 'completed' ? 'bg-green-600' : 'bg-yellow-600'}>
                          {meeting.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-6 text-slate-300 text-sm">
                        <span>{meeting.date}</span>
                        <span>{meeting.duration}</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {meeting.participants} participants
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {meeting.transcript && (
                        <Link to={`/transcript/${meeting.id}`}>
                          <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                            <FileText className="h-4 w-4 mr-1" />
                            Transcript
                          </Button>
                        </Link>
                      )}
                      {meeting.summary && (
                        <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                          Summary
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                        <Download className="h-4 w-4 mr-1" />
                        Export
                      </Button>
                      <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                        <Share className="h-4 w-4 mr-1" />
                        Share
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Start Guide */}
        <Card className="bg-gradient-to-r from-purple-600/20 to-purple-800/20 backdrop-blur-md border-white/20">
          <CardHeader>
            <CardTitle className="text-white text-xl">Getting Started</CardTitle>
            <CardDescription className="text-slate-300">
              Follow these steps to start transcribing your first meeting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold">1</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Start Bot</h3>
                <p className="text-slate-300 text-sm">Click "Start New Bot" and provide the meeting URL</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold">2</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Auto Transcribe</h3>
                <p className="text-slate-300 text-sm">Watch real-time transcription as the meeting progresses</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold">3</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Share & Collaborate</h3>
                <p className="text-slate-300 text-sm">Edit, summarize, and share results with your team</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
