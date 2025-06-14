
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, FileText, Users, Calendar, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface Note {
  id: number;
  title: string;
  content: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
  group_id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface Group {
  id: number;
  name: string;
}

const Notes: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | 'all'>('all');
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch user's groups for filtering
  const { data: groups = [] } = useQuery({
    queryKey: ['user-groups-simple', user?.id],
    queryFn: async (): Promise<Group[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_groups_with_stats')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Error fetching groups:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!user,
    staleTime: 60000 // Cache for 1 minute
  });

  // Fetch notes using the optimized view
  const { data: notes = [], isLoading, error } = useQuery({
    queryKey: ['user-notes', user?.id, selectedGroupId, searchTerm],
    queryFn: async (): Promise<Note[]> => {
      if (!user) throw new Error('User not authenticated');

      console.log('Fetching notes using optimized view...');
      
      let query = supabase
        .from('notes_with_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply group filter
      if (selectedGroupId !== 'all') {
        query = query.eq('group_id', selectedGroupId);
      }

      // Apply search filter
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching notes:', error);
        throw error;
      }

      console.log('Notes fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!user,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false
  });

  const handleCreateNote = () => {
    navigate('/note-editor');
  };

  const handleNoteClick = (noteId: number) => {
    navigate(`/note-editor/${noteId}`);
  };

  const getAuthorName = (note: Note) => {
    if (note.first_name || note.last_name) {
      return `${note.first_name || ''} ${note.last_name || ''}`.trim();
    }
    if (note.email) {
      return note.email;
    }
    return `User ${note.user_id.slice(0, 8)}...`;
  };

  const getGroupName = (groupId: number) => {
    const group = groups.find(g => g.id === groupId);
    return group?.name || 'Unknown Group';
  };

  const filteredNotes = notes;

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Notes</h2>
          <p className="text-gray-600 mb-4">
            {error instanceof Error ? error.message : 'Failed to load notes'}
          </p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['user-notes'] })}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Notes</h1>
              <p className="text-slate-300">
                Manage and organize your group notes
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

          {/* Search and Filter Controls */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-slate-400"
              />
            </div>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white"
            >
              <option value="all">All Groups</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white">Loading notes...</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-2xl font-semibold text-white mb-2">
              {searchTerm || selectedGroupId !== 'all' ? 'No notes found' : 'No notes yet'}
            </h3>
            <p className="text-slate-300 mb-6">
              {searchTerm || selectedGroupId !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Create your first note to get started.'
              }
            </p>
            <Button 
              onClick={handleCreateNote}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Note
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredNotes.map((note) => (
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
                    <div className="flex gap-1 ml-2">
                      {note.is_private && (
                        <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-400">
                          Private
                        </Badge>
                      )}
                      {note.user_id === user?.id && (
                        <Badge variant="secondary" className="text-xs">
                          Mine
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Users className="h-3 w-3" />
                      <span className="truncate">{getGroupName(note.group_id)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <User className="h-3 w-3" />
                      <span className="truncate">{getAuthorName(note)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(note.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardHeader>
                
                {note.content && (
                  <CardContent className="pt-0">
                    <p className="text-slate-300 text-sm line-clamp-3">
                      {note.content}
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
