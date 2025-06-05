
import React from 'react';
import { Link } from 'react-router-dom';
import { Mic, Users, FileText, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black">
      {/* Header */}
      <header className="px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src="/lovable-uploads/e8e442bd-846b-4e60-b16a-3043d419243f.png" alt="NeuroNotes" className="h-8 w-auto" />
            <span className="text-2xl font-bold text-white">NeuroNotes</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/login">
              <Button variant="ghost" className="text-white hover:bg-white/10">
                Login
              </Button>
            </Link>
            <Link to="/register">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white">
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
              AI-Powered Meeting
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                {" "}Transcription
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto">
              Join any online meeting or upload recorded audio. Get real-time transcriptions, 
              summaries, and collaborate with your team - all automatically powered by AI.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 text-lg">Start Now</Button>
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
            <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <img src="/lovable-uploads/e8e442bd-846b-4e60-b16a-3043d419243f.png" alt="NeuroNotes" className="h-12 w-12 mb-4" />
                <CardTitle className="text-white">Smart Meeting Assistant</CardTitle>
                <CardDescription className="text-slate-300">
                  Automatically join Google Meet, Zoom, and other online meetings for seamless transcription
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <Mic className="h-12 w-12 text-pink-400 mb-4" />
                <CardTitle className="text-white">Real-time Transcription</CardTitle>
                <CardDescription className="text-slate-300">
                  Powered by advanced AI for accurate, real-time speech-to-text conversion
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
          <div className="text-center bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md rounded-2xl p-12 border border-white/20">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Transform Your Meetings?
            </h2>
            <p className="text-xl text-slate-300 mb-8">
              Join thousands of teams already using NeuroNotes
            </p>
            <Link to="/register">
              <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-12 py-4 text-lg">Start Now</Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-white/20 bg-white/5">
        <div className="max-w-7xl mx-auto text-center text-slate-400">
          <p>&copy; 2024 NeuroNotes. All rights reserved.</p>
        </div>
      </footer>
    </div>;
};

export default Index;
