import React from 'react';
import { Link } from 'react-router-dom';
import { Bot, Mic, Users, FileText, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
const Index = () => {
  return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-teal-900">
      {/* Header */}
      <header className="px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="h-8 w-8 text-teal-400" />
            <span className="text-2xl font-bold text-white">NeuroNotes</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/login">
              <Button variant="ghost" className="text-white hover:bg-white/10">
                Login
              </Button>
            </Link>
            <Link to="/register">
              <Button className="bg-teal-600 hover:bg-teal-700 text-white">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Automate Meeting
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-400">
                {" "}Transcription
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto">
              Join any online meeting with AI-powered bots. Get real-time transcriptions, 
              summaries, and collaborate with your team - all automatically.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button size="lg" className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white px-8 py-4 text-lg">
                  Start Free Trial
                </Button>
              </Link>
              <Link to="/demo">
                
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
            <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <Bot className="h-12 w-12 text-teal-400 mb-4" />
                <CardTitle className="text-white">Automated Bot Joining</CardTitle>
                <CardDescription className="text-slate-300">
                  Our bots automatically join Google Meet, Zoom, and YouTube Live sessions
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <Mic className="h-12 w-12 text-blue-400 mb-4" />
                <CardTitle className="text-white">Real-time Transcription</CardTitle>
                <CardDescription className="text-slate-300">
                  Powered by Deepgram AI for accurate, real-time speech-to-text conversion
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <Users className="h-12 w-12 text-purple-400 mb-4" />
                <CardTitle className="text-white">Team Collaboration</CardTitle>
                <CardDescription className="text-slate-300">
                  Edit transcripts together in real-time with your team members
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <FileText className="h-12 w-12 text-green-400 mb-4" />
                <CardTitle className="text-white">Smart Summaries</CardTitle>
                <CardDescription className="text-slate-300">
                  AI-generated meeting summaries with key points and action items
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <Shield className="h-12 w-12 text-red-400 mb-4" />
                <CardTitle className="text-white">Secure & Private</CardTitle>
                <CardDescription className="text-slate-300">
                  End-to-end encryption with secure sharing via unique URLs
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <Zap className="h-12 w-12 text-yellow-400 mb-4" />
                <CardTitle className="text-white">Instant Export</CardTitle>
                <CardDescription className="text-slate-300">
                  Download transcripts and summaries or save to cloud storage
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* CTA Section */}
          <div className="text-center bg-gradient-to-r from-teal-600/20 to-blue-600/20 backdrop-blur-md rounded-2xl p-12 border border-white/20">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Transform Your Meetings?
            </h2>
            <p className="text-xl text-slate-300 mb-8">
              Join thousands of teams already using TranscribeBot Pro
            </p>
            <Link to="/register">
              <Button size="lg" className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white px-12 py-4 text-lg">
                Start Your Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-white/20 bg-white/5">
        <div className="max-w-7xl mx-auto text-center text-slate-400">
          <p>&copy; 2024 TranscribeBot Pro. All rights reserved.</p>
        </div>
      </footer>
    </div>;
};
export default Index;