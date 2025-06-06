
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Search, FileText, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Note {
  id: string;
  title: string;
  content: string;
  source_type: string;
  created_at: string;
  duration?: number;
}

const Notes = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchNotes();
    }
  }, [user]);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('transcriptions')
        .select('id, title, content, source_type, created_at, duration')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'upload':
        return <FileText className="h-4 w-4" />;
      case 'live_meeting':
        return <Calendar className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getSourceLabel = (sourceType: string) => {
    switch (sourceType) {
      case 'upload':
        return 'File Upload';
      case 'live_meeting':
        return 'Live Meeting';
      default:
        return 'Unknown';
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
              <img src="/lovable-uploads/2d11ec38-9fc4-4af5-9224-4b5b20a91803.png" alt="NeuroNotes" className="h-12 w-auto" />
              <span className="text-2xl font-bold text-white">NeuroNotes</span>
            </div>
            <span className="text-slate-400">/</span>
            <span className="text-white font-medium">Notes & Transcriptions</span>
          </div>
          <Link to="/dashboard">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              New Recording
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Your Notes & Transcriptions</h1>
          <p className="text-xl text-slate-300">Manage and search through all your recorded content</p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
            <Input
              placeholder="Search your notes and transcriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Notes Grid */}
        {loading ? (
          <div className="text-center text-white">Loading your notes...</div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center text-slate-300">
            {searchTerm ? 'No notes found matching your search.' : 'No notes yet. Start by recording or uploading audio.'}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredNotes.map((note) => (
              <Card key={note.id} className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-white text-lg truncate">{note.title}</CardTitle>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="bg-purple-600/20 text-purple-300">
                      {getSourceIcon(note.source_type)}
                      <span className="ml-1">{getSourceLabel(note.source_type)}</span>
                    </Badge>
                    {note.duration && (
                      <div className="flex items-center text-slate-400 text-sm">
                        <Clock className="h-4 w-4 mr-1" />
                        {formatDuration(note.duration)}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 text-sm line-clamp-3 mb-4">
                    {note.content ? note.content.substring(0, 150) + '...' : 'No content available'}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">{formatDate(note.created_at)}</span>
                    <Link to={`/transcript/${note.id}`}>
                      <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                        View
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notes;
