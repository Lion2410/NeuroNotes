import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Recycle, Delete, Clock, Download, Share, FileText, Plus, Search } from 'lucide-react';
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
  const [massDeleteOpen, setMassDeleteOpen] = useState(false);
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
    setMassDeleteOpen(false);
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

  // MassDeleteDialog as a controlled dialog, rendered outside the header
  const massDeleteComponent = (
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
  );

  if (error) {
    return (
      <div className="min-h-screen relative">
        {/* Fixed Background */}
        <div 
          className="fixed inset-0 z-0"
          style={{
            background: 'linear-gradient(to bottom, #201840 0%, #551B83 47%, #1E092F 100%)'
          }}
        />
        
        {/* Content Layer */}
        <div className="relative z-10">
          <NotesHeader onBack={handleBack} onCreateNote={handleCreateNote} />
          <div className="container mx-auto px-6 py-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-400 mb-4">Error Loading Notes</h2>
              <p className="text-white mb-4">
                {error instanceof Error ? error.message : 'Failed to load notes'}
              </p>
              <Button 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['user-transcriptions'] })}
                className="bg-white/20 hover:bg-white/30 text-white"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Fixed Background */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          background: 'linear-gradient(to bottom, #201840 0%, #551B83 47%, #1E092F 100%)'
        }}
      />
      
      {/* Content Layer */}
      <div className="relative z-10">
        <NotesHeader 
          onBack={handleBack} 
          onCreateNote={handleCreateNote}
          showMassDelete={notes.length > 0}
          massDeleteComponent={
            notes.length > 0 ? (
              <div className="hidden md:block">
                <Button 
                  variant="outline" 
                  className="border-red-500/50 hover:bg-red-500/20 text-red-400 hover:text-red-300"
                  onClick={() => setMassDeleteOpen(true)}
                >
                  <Delete className="h-4 w-4 mr-2" />
                  Mass Delete
                </Button>
              </div>
            ) : null
          }
        />

        <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-8">
          {/* Search Section */}
          <div className="mb-6 sm:mb-8">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/70 h-5 w-5" />
              <Input
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/70 focus:border-white/40 focus:ring-white/40 rounded-xl"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white">Loading notes...</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="h-20 w-20 text-white/50 mx-auto mb-6" />
              <h3 className="text-2xl font-semibold text-white mb-3">
                {searchTerm ? 'No notes found' : 'No notes yet'}
              </h3>
              <p className="text-white/70 mb-8 max-w-md mx-auto">
                {searchTerm 
                  ? 'Try adjusting your search criteria.'
                  : 'Create your first note by starting a recording or joining a meeting.'
                }
              </p>
              {!searchTerm && (
                <Button 
                  onClick={handleCreateNote}
                  className="bg-white/20 hover:bg-white/30 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Note
                </Button>
              )}
            </div>
          ) : (
            <div
              className="
                grid grid-cols-1 
                sm:grid-cols-2 
                lg:grid-cols-3 
                xl:grid-cols-4 
                gap-2 sm:gap-4
              "
            >
              {notes.map((note) => (
                <Card 
                  key={note.id}
                  className="
                    bg-white/10 
                    backdrop-blur-md 
                    border-white/20 
                    hover:bg-white/15 
                    transition-all duration-200 
                    rounded-xl sm:rounded-2xl 
                    overflow-hidden cursor-pointer group
                    p-2 sm:p-0
                  "
                  onClick={() => handleNoteClick(note.id)}
                >
                  <CardContent
                    className="
                      p-2 sm:p-4
                    "
                  >
                    <div className="space-y-2 sm:space-y-3">
                      {/* Header with badge and duration */}
                      <div className="flex items-center justify-between">
                        <Badge 
                          variant="secondary" 
                          className="bg-white/20 text-white border-white/30 px-2 py-1 text-xs font-medium"
                        >
                          {note.source_type === 'upload' ? 'Upload' : note.source_type}
                        </Badge>
                        {note.duration && (
                          <div className="flex items-center gap-1 text-white/70 text-[11px] sm:text-xs">
                            <Clock className="h-3 w-3" />
                            <span>{formatDuration(note.duration)}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Title */}
                      <h3 className="text-base sm:text-lg font-semibold text-white line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem]">
                        {note.title}
                      </h3>
                      
                      {/* Content preview */}
                      {(note.content || note.summary) && (
                        <p className="text-xs sm:text-sm text-white/80 line-clamp-3 min-h-[2.5rem] sm:min-h-[3.75rem]">
                          {note.summary || (note.content && note.content.substring(0, 80) + '...')}
                        </p>
                      )}
                      
                      {/* Footer with date and actions */}
                      <div className="flex items-center justify-between pt-1 sm:pt-2">
                        <div className="flex items-center gap-1 text-white/70 text-[11px] sm:text-xs">
                          <Clock className="h-3 w-3" />
                          <span>{formatDate(note.created_at)}</span>
                        </div>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-white/70 hover:text-white hover:bg-white/10 h-7 w-7 sm:h-8 sm:w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle export
                            }}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-white/70 hover:text-white hover:bg-white/10 h-7 w-7 sm:h-8 sm:w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle share
                            }}
                          >
                            <Share className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        {/* Mobile Mass Delete Floating Button */}
        {notes.length > 0 && (
          <>
            {/* FAB for mobile screens only */}
            <div className="fixed bottom-6 right-6 z-40 md:hidden">
              <Button
                size="lg"
                className="rounded-full bg-red-600 hover:bg-red-700 shadow-lg text-white px-0 py-0 h-14 w-14 flex items-center justify-center"
                onClick={() => setMassDeleteOpen(true)}
                aria-label="Recycle bin"
              >
                <Recycle className="h-7 w-7" />
              </Button>
            </div>
            {/* Dialog rendered, controlled by massDeleteOpen */}
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
              isOpen={massDeleteOpen}
              setIsOpen={setMassDeleteOpen}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Notes;
