import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, FileText, Clock, Download, Share } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import MassDeleteDialog from '@/components/MassDeleteDialog';
import NotesHeader from '@/components/NotesHeader';

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
    staleTime: 30000,
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

  const handleNotesDeleted = () => {
    queryClient.invalidateQueries({ queryKey: ['user-transcriptions'] });
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <NotesHeader onBack={handleBack} onCreateNote={handleCreateNote} />
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Error Loading Notes</h2>
            <p className="text-gray-300 mb-4">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <NotesHeader 
        onBack={handleBack} 
        onCreateNote={handleCreateNote}
        showMassDelete={notes.length > 0}
        massDeleteComponent={
          notes.length > 0 ? (
            <MassDeleteDialog 
              notes={notes.map(note => ({
                id: note.id,
                title: note.title,
                content: note.content || '',
                created_at: note.created_at,
                updated_at: note.updated_at,
                source_type: note.source_type,
                duration: note.duration
              }))}
              onNotesDeleted={handleNotesDeleted}
            />
          ) : null
        }
      />

      <div className="container mx-auto px-6 py-8">
        {/* Search Section */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 bg-gray-800/60 backdrop-blur-sm border-gray-600/50 text-white placeholder:text-gray-400 focus:border-purple-500 focus:ring-purple-500 rounded-xl"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-300">Loading notes...</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-20 w-20 text-gray-500 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold text-white mb-3">
              {searchTerm ? 'No notes found' : 'No notes yet'}
            </h3>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
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
          <div className="space-y-4">
            {notes.map((note) => (
              <Card 
                key={note.id} 
                className="bg-gray-800/80 backdrop-blur-md border-gray-700/50 hover:bg-gray-800/90 transition-all duration-200 rounded-2xl overflow-hidden cursor-pointer"
                onClick={() => handleNoteClick(note.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left side - Note info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <Badge 
                          variant="secondary" 
                          className="bg-purple-600/20 text-purple-300 border-purple-500/30 px-3 py-1 text-xs font-medium"
                        >
                          {note.source_type === 'upload' ? 'Upload' : note.source_type}
                        </Badge>
                        {note.duration && (
                          <div className="flex items-center gap-1 text-gray-400 text-sm">
                            <Clock className="h-3 w-3" />
                            <span>{formatDuration(note.duration)}</span>
                          </div>
                        )}
                      </div>
                      
                      <h3 className="text-xl font-semibold text-white mb-2 line-clamp-1">
                        {note.title}
                      </h3>
                      
                      {(note.content || note.summary) && (
                        <p className="text-gray-300 text-sm line-clamp-2 mb-3">
                          {note.summary || (note.content && note.content.substring(0, 120) + '...')}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-1 text-gray-400 text-sm">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(note.created_at)}</span>
                      </div>
                    </div>

                    {/* Right side - Action buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-white hover:bg-gray-700/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle export
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-white hover:bg-gray-700/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle share
                        }}
                      >
                        <Share className="h-4 w-4" />
                      </Button>
                    </div>
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
