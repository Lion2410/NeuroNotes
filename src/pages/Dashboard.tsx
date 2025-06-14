import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Plus, Search, Filter, Play, Users, FileText, Download, Share, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Note {
  id: string;
  title: string;
  created_at: string;
  duration: number | null;
  source_type: string;
  content: string;
}

const Dashboard = () => {
  const [activeSession, setActiveSession] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [notes, setNotes] = useState<Note[]>([]);
  const [totalNotes, setTotalNotes] = useState(0);
  const [totalGroups, setTotalGroups] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchNotes();
      fetchGroupsCount();
    }
  }, [user]);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('transcriptions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      setNotes(data || []);
      setTotalNotes(data?.length || 0);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch notes.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupsCount = async () => {
    try {
      const { count, error } = await supabase
        .from('groups')
        .select('*', { count: 'exact', head: true })
        .or(`creator_id.eq.${user?.id},group_members.user_id.eq.${user?.id}`)
        .inner('group_members', 'id', 'group_id');

      if (error) {
        console.error('Error fetching groups count:', error);
        return;
      }
      setTotalGroups(count || 0);
    } catch (error: any) {
      console.error('Error fetching groups count:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Get recent notes (latest 3)
  const recentNotes = notes.slice(0, 3).map(note => ({
    id: note.id,
    title: note.title,
    date: new Date(note.created_at).toLocaleDateString(),
    duration: note.duration ? `${note.duration} min` : 'Unknown',
    status: 'completed',
    notes: true,
    summary: false,
    participants: 1
  }));

  // Filter notes based on search and status
  const filteredNotes = recentNotes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || note.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black">
      {/* Header */}
      <header className="px-3 sm:px-6 py-3 sm:py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src="/lovable-uploads/2d11ec38-9fc4-4af5-9224-4b5b20a91803.png" alt="NeuroNotes" className="h-8 sm:h-12 w-auto" />
            <span className="text-lg sm:text-2xl font-bold text-white">NeuroNotes</span>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <span className="text-white text-xs sm:text-base hidden sm:block">Welcome, {user?.email}</span>
            <Link to="/profile">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 p-1 sm:p-2">
                <User className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Profile</span>
              </Button>
            </Link>
            <Button onClick={handleSignOut} variant="ghost" size="sm" className="text-white hover:bg-white/10 p-1 sm:p-2">
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* Welcome Section */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Welcome back!</h1>
          <p className="text-slate-300 text-sm sm:text-base">Manage your note sessions and collaborate with your team.</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300">
            <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2 text-sm sm:text-base">
                  <img src="/lovable-uploads/2d11ec38-9fc4-4af5-9224-4b5b20a91803.png" alt="NeuroNotes" className="h-4 w-4 sm:h-6 sm:w-6" />
                  Session Status
                </CardTitle>
                <Badge variant={activeSession ? "default" : "secondary"} className={`text-xs ${activeSession ? "bg-green-600" : "bg-slate-600"}`}>
                  {activeSession ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <p className="text-slate-300 mb-3 sm:mb-4 text-xs sm:text-sm">
                {activeSession ? "AI assistant is currently in a session" : "Start a new note session"}
              </p>
              <Link to="/join-meeting">
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm py-2">
                  <Play className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  Start New Session
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300 cursor-pointer" onClick={() => navigate('/notes')}>
            <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
              <CardTitle className="text-white flex items-center gap-2 text-sm sm:text-base">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                Total Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-2xl sm:text-3xl font-bold text-white mb-2">{totalNotes}</div>
              <p className="text-slate-300 text-xs sm:text-sm">{notes.length} total notes</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300 cursor-pointer sm:col-span-2 lg:col-span-1" onClick={() => navigate('/groups')}>
            <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
              <CardTitle className="text-white flex items-center gap-2 text-sm sm:text-base">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
                Groups
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-2xl sm:text-3xl font-bold text-white mb-2">{totalGroups}</div>
              <p className="text-slate-300 text-xs sm:text-sm">Active groups</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Notes */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Recent Notes</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-3 w-3 sm:h-4 sm:w-4 text-slate-400" />
                <Input 
                  placeholder="Search notes..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="pl-8 sm:pl-10 bg-white/10 border-white/20 text-white placeholder:text-slate-400 w-full sm:w-64 text-xs sm:text-sm h-8 sm:h-10" 
                />
              </div>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)} 
                className="bg-white/10 border border-white/20 text-white rounded-md px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm h-8 sm:h-10"
              >
                <option value="all" className="bg-slate-800">All Status</option>
                <option value="completed" className="bg-slate-800">Completed</option>
                <option value="processing" className="bg-slate-800">Processing</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {loading ? (
              <div className="text-center text-white text-sm sm:text-base">Loading notes...</div>
            ) : filteredNotes.length === 0 ? (
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6 sm:p-12 text-center">
                  <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">No Notes Found</h3>
                  <p className="text-slate-300 mb-4 sm:mb-6 text-xs sm:text-sm">
                    {searchTerm ? 'No notes match your search.' : 'You haven\'t created any notes yet.'}
                  </p>
                  <Link to="/join-meeting">
                    <Button className="bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm">
                      Create Your First Note
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              filteredNotes.map((note) => (
                <Card 
                  key={note.id} 
                  className="bg-[#5A2E8E]/20 backdrop-blur-md border-white/20 hover:bg-[#5A2E8E]/30 transition-all duration-300 cursor-pointer"
                  onClick={() => navigate(`/transcript/${note.id}`)}
                >
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                          <h3 className="text-base sm:text-lg font-semibold text-white">{note.title}</h3>
                          <Badge 
                            variant={note.status === 'completed' ? 'default' : 'secondary'} 
                            className={`text-xs w-fit ${note.status === 'completed' ? 'bg-green-600' : 'bg-yellow-600'}`}
                          >
                            {note.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-slate-300 text-xs sm:text-sm">
                          <span>{note.date}</span>
                          <span>{note.duration}</span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                            {note.participants} participants
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                        {note.notes && (
                          <Button size="sm" variant="outline" className="border-white/30 hover:bg-white/10 text-slate-950 text-xs px-2 py-1">
                            <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="hidden sm:inline">Notes</span>
                          </Button>
                        )}
                        {note.summary && (
                          <Button size="sm" variant="outline" className="border-white/30 hover:bg-white/10 text-slate-950 text-xs px-2 py-1">
                            <span className="hidden sm:inline">Summary</span>
                            <span className="sm:hidden">Sum</span>
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="border-white/30 hover:bg-white/10 text-slate-950 text-xs px-2 py-1">
                          <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          <span className="hidden sm:inline">Export</span>
                        </Button>
                        <Button size="sm" variant="outline" className="border-white/30 hover:bg-white/10 text-slate-950 text-xs px-2 py-1">
                          <Share className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          <span className="hidden sm:inline">Share</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Quick Start Guide */}
        <Card className="bg-gradient-to-r from-purple-600/20 to-purple-800/20 backdrop-blur-md border-white/20">
          <CardHeader className="bg-[#2e0936] p-4 sm:p-6">
            <CardTitle className="text-white text-lg sm:text-xl">Getting Started</CardTitle>
            <CardDescription className="text-slate-300 text-xs sm:text-sm">
              Follow these steps to start note-taking for your first session
            </CardDescription>
          </CardHeader>
          <CardContent className="bg-[#2d0935] p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 bg-purple-600">
                  <span className="text-white font-bold text-sm sm:text-base">1</span>
                </div>
                <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">Start Session</h3>
                <p className="text-slate-300 text-xs sm:text-sm">Click "Start New Session" and choose to join a meeting or upload audio</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-700 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <span className="text-white font-bold text-sm sm:text-base">2</span>
                </div>
                <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">AI Note-taking</h3>
                <p className="text-slate-300 text-xs sm:text-sm">Watch real-time note generation as the meeting progresses or audio processes</p>
              </div>
              <div className="text-center sm:col-span-2 lg:col-span-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-800 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <span className="text-white font-bold text-sm sm:text-base">3</span>
                </div>
                <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">Share & Collaborate</h3>
                <p className="text-slate-300 text-xs sm:text-sm">Edit, summarize, and share results with your team</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
