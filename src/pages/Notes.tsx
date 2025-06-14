
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, FileText, Calendar, Clock, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface Transcription {
  id: string;
  title: string;
  content: string | null;
  source_type: string;
  duration: number | null;
  created_at: string;
  updated_at: string;
  summary: string | null;
}

const Notes: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch user's personal transcriptions
  const { data: notes = [], isLoading, error } = useQuery({
    queryKey: ['user-transcriptions', user?.id, searchTerm],
    queryFn: async (): Promise<Transcription[]> => {
      if (!user) throw new Error('User not authenticated');

      console.log('Fetching user transcriptions...');
      
      let query = supabase
        .from('transcriptions')
        .select('id, title, content, source_type, duration, created_at, updated_at, summary')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      // Apply search filter
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching transcriptions:', error);
        throw error;
      }

      console.log('Transcriptions fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!user,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false
  });

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleCreateNote = () => {
    navigate('/join-meeting');
  };

  const handleNoteClick = (transcriptionId: string) => {
    navigate(`/transcript/${transcriptionId}`);
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Error Loading Notes</h2>
            <p className="text-slate-300 mb-4">
              {error instanceof Error ? error.message : 'Failed to load notes'}
            </p>
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['user-transcriptions'] })}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">My Notes</h1>
              <p className="text-slate-300">
                All your transcriptions and notes in one place
              </p>
            </div>
            <Button 
              onClick={handleCreateNote}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Note
            </Button>
          </div>

          {/* Search Controls */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search your notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white">Loading notes...</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-2xl font-semibold text-white mb-2">
              {searchTerm ? 'No notes found' : 'No notes yet'}
            </h3>
            <p className="text-slate-300 mb-6">
              {searchTerm 
                ? 'Try adjusting your search criteria.'
                : 'Create your first note by starting a recording or joining a meeting.'
              }
            </p>
            {!searchTerm && (
              <Button 
                onClick={handleCreateNote}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Note
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => (
              <Card 
                key={note.id} 
                className="bg-white/10 backdrop-blur-md border-white/20 cursor-pointer hover:bg-white/20 transition-all duration-200"
                onClick={() => handleNoteClick(note.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start mb-2">
                    <CardTitle className="text-white text-lg line-clamp-2">
                      {note.title}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs ml-2">
                      {note.source_type}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Calendar className="h-3 w-3" />
                      <span>Created {new Date(note.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    {note.duration && (
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Clock className="h-3 w-3" />
                        <span>{formatDuration(note.duration)}</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                {(note.content || note.summary) && (
                  <CardContent className="pt-0">
                    <p className="text-slate-300 text-sm line-clamp-3">
                      {note.summary || (note.content && note.content.substring(0, 150) + '...')}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notes;
