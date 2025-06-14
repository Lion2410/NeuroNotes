import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import EditableTitle from '@/components/EditableTitle';
import NoteContent from '@/components/transcript/NoteContent';
import NoteActions from '@/components/transcript/NoteActions';
import NoteMetadata from '@/components/transcript/NoteMetadata';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface Transcription {
  id: string;
  title: string;
  content: string;
  summary: string;
  source_type: string;
  created_at: string;
  duration?: number;
  user_id: string;
}

const NoteEditor = () => {
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState<Transcription | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [editingContent, setEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isGroupSharedNote, setIsGroupSharedNote] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (id && user) {
      fetchNote();
    }
  }, [id, user]);

  const fetchNote = async () => {
    try {
      console.log('=== FETCHING NOTE ===');
      console.log('Note ID:', id);
      console.log('Current user ID:', user?.id);
      console.log('User object:', user);
      
      // First, try to fetch the note directly
      console.log('Step 1: Attempting direct note access...');
      const { data: directData, error: directError } = await supabase
        .from('transcriptions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      console.log('Direct note query result:', directData);
      console.log('Direct note query error:', directError);

      if (directError) {
        console.error('Error in direct note query:', directError);
        throw new Error(`Direct query failed: ${directError.message}`);
      }

      if (directData) {
        console.log('✅ Direct access successful - user owns this note');
        setNote(directData);
        setEditedContent(directData.content || '');
        setIsGroupSharedNote(false);
        console.log('Note loaded successfully via direct access');
      } else {
        console.log('Step 2: Direct access failed, checking group access...');
        
        // Check if this note is shared in any groups the user belongs to
        const { data: groupNotes, error: groupError } = await supabase
          .from('group_notes_with_details')
          .select('*')
          .eq('transcription_id', id);
        
        console.log('Group notes query result:', groupNotes);
        console.log('Group notes query error:', groupError);
        
        if (groupError) {
          console.error('Group notes query error:', groupError);
          throw new Error(`Group access query failed: ${groupError.message}`);
        }

        if (groupNotes && groupNotes.length > 0) {
          console.log('✅ Group access found - reconstructing note data...');
          
          // Use the first group note (they should all have the same note data)
          const groupNote = groupNotes[0];
          console.log('Using group note data:', groupNote);
          
          const noteData: Transcription = {
            id: groupNote.transcription_id,
            title: groupNote.title,
            content: groupNote.content,
            summary: '', // Will be fetched separately
            source_type: groupNote.source_type,
            created_at: groupNote.transcription_created_at,
            duration: groupNote.duration,
            user_id: groupNote.transcription_owner
          };
          
          console.log('Step 3: Fetching summary from original transcription...');
          // Fetch the summary from the original transcription
          try {
            const { data: originalNote, error: summaryError } = await supabase
              .from('transcriptions')
              .select('summary')
              .eq('id', id)
              .maybeSingle();
            
            console.log('Summary fetch result:', originalNote);
            console.log('Summary fetch error:', summaryError);
            
            if (summaryError) {
              console.warn('Could not fetch summary:', summaryError);
              // Don't fail the entire operation if summary fetch fails
            } else if (originalNote) {
              noteData.summary = originalNote.summary || '';
              console.log('Summary fetched successfully:', originalNote.summary ? 'Has summary' : 'No summary');
            } else {
              console.log('No summary data found');
            }
          } catch (summaryFetchError) {
            console.warn('Summary fetch failed, continuing without summary:', summaryFetchError);
            // Continue without summary rather than failing
          }
          
          console.log('Final note data:', noteData);
          setNote(noteData);
          setEditedContent(noteData.content || '');
          setIsGroupSharedNote(true);
          console.log('✅ Note loaded successfully via group access');
        } else {
          console.log('❌ No group access found');
          throw new Error('Note not found or access denied - no direct access and no group sharing found');
        }
      }
    } catch (error) {
      console.error('=== NOTE FETCH ERROR ===');
      console.error('Error type:', typeof error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('Full error object:', error);
      
      toast({
        title: "Error",
        description: `Failed to load note: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      console.log('=== FETCH COMPLETE ===');
      setLoading(false);
    }
  };

  const handleTitleUpdate = async (newTitle: string) => {
    if (!note || isGroupSharedNote) return;

    try {
      const { error } = await supabase
        .from('transcriptions')
        .update({ title: newTitle })
        .eq('id', note.id);

      if (error) throw error;

      setNote(prev => prev ? { ...prev, title: newTitle } : null);
      
      toast({
        title: "Title Updated",
        description: "Note title has been updated successfully."
      });
    } catch (error) {
      console.error('Error updating title:', error);
      toast({
        title: "Error",
        description: "Failed to update title.",
        variant: "destructive"
      });
    }
  };

  const generateSummary = async () => {
    if (!note?.content) return;

    setGeneratingSummary(true);
    try {
      const response = await supabase.functions.invoke('generate-summary-hf', {
        body: { content: note.content }
      });

      if (response.error) throw response.error;

      const { summary } = response.data;

      const { error } = await supabase
        .from('transcriptions')
        .update({ summary })
        .eq('id', note.id);

      if (error) throw error;

      setNote(prev => prev ? { ...prev, summary } : null);

      toast({
        title: "Summary Generated",
        description: "Summary has been generated and saved successfully."
      });
    } catch (error) {
      console.error('Error generating summary:', error);
      toast({
        title: "Error",
        description: "Failed to generate summary. Please try again.",
        variant: "destructive"
      });
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleContentUpdate = async () => {
    if (!note || isGroupSharedNote) return;

    try {
      const { error } = await supabase
        .from('transcriptions')
        .update({ content: editedContent })
        .eq('id', note.id);

      if (error) throw error;

      setNote(prev => prev ? { ...prev, content: editedContent } : null);
      setEditingContent(false);

      toast({
        title: "Content Updated",
        description: "Note content has been updated successfully."
      });
    } catch (error) {
      console.error('Error updating content:', error);
      toast({
        title: "Error",
        description: "Failed to update content.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    if (!note || isGroupSharedNote) return;

    try {
      const { error } = await supabase
        .from('transcriptions')
        .delete()
        .eq('id', note.id);

      if (error) throw error;

      toast({
        title: "Note Deleted",
        description: "Note has been deleted successfully."
      });

      window.location.href = '/notes';
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: "Error",
        description: "Failed to delete note.",
        variant: "destructive"
      });
    }
  };

  const handleDownload = () => {
    if (!note) return;
    
    const element = document.createElement('a');
    const file = new Blob([note.content || ''], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${note.title}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    
    toast({
      title: "Download Started",
      description: "Your note is being downloaded."
    });
  };

  const handleShare = () => {
    if (navigator.share && note) {
      navigator.share({
        title: note.title,
        text: note.content,
        url: window.location.href
      });
    } else {
      toast({
        title: "Share",
        description: "Copy the URL to share this note."
      });
    }
  };

  const handleCopy = () => {
    if (!note?.content) return;
    
    navigator.clipboard.writeText(note.content);
    toast({
      title: "Copied",
      description: "Note has been copied to clipboard."
    });
  };

  // Check if current user is the owner
  const isOwner = note?.user_id === user?.id;
  // Group members can generate summaries but cannot edit content or delete
  const canGenerateSummary = isOwner || isGroupSharedNote;
  const canEditContent = isOwner && !isGroupSharedNote;
  const canDelete = isOwner && !isGroupSharedNote;

  console.log('=== RENDER STATE ===');
  console.log('Loading:', loading);
  console.log('Note exists:', !!note);
  console.log('Is group shared:', isGroupSharedNote);
  console.log('Is owner:', isOwner);
  console.log('Can generate summary:', canGenerateSummary);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-white">Loading note...</div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-white">Note not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black">
      {/* Header */}
      <header className="px-4 md:px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 md:space-x-4">
            <Link to="/notes" className="text-white hover:text-purple-400 transition-colors">
              <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
            </Link>
            <div className="flex items-center space-x-2">
              <img src="/lovable-uploads/82423172-8fa2-4a61-9691-e45ac0c5f57c.png" alt="NeuroNotes" className="h-8 md:h-12 w-auto" />
              <span className="text-lg md:text-2xl font-bold text-white">NeuroNotes</span>
            </div>
            <span className="text-slate-400 hidden md:block">/</span>
            {canEditContent ? (
              <EditableTitle
                title={note.title}
                onUpdate={handleTitleUpdate}
                className="text-white font-medium text-sm md:text-base"
              />
            ) : (
              <span className="text-white font-medium text-sm md:text-base">{note.title}</span>
            )}
            {isGroupSharedNote && (
              <span className="text-xs text-purple-300 bg-purple-600/20 px-2 py-1 rounded">
                Shared in Group
              </span>
            )}
          </div>
          {canEditContent && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingContent(true)}
                className="border-white/30 hover:bg-white/10 text-slate-950"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              {canDelete && (
                <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500/30 hover:bg-red-500/10 text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-900 border-slate-700">
                    <DialogHeader>
                      <DialogTitle className="text-white">Delete Note</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-slate-300">Are you sure you want to delete this note? This action cannot be undone.</p>
                      <div className="flex gap-2">
                        <Button onClick={handleDelete} variant="destructive">Delete</Button>
                        <Button onClick={() => setShowDeleteDialog(false)} variant="outline">Cancel</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8">
        <div className="grid lg:grid-cols-3 gap-4 md:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-white/10 mb-4">
                <TabsTrigger value="content" className="text-white data-[state=active]:bg-purple-600">Content</TabsTrigger>
                <TabsTrigger value="summary" className="text-white data-[state=active]:bg-purple-600">Summary</TabsTrigger>
              </TabsList>
              
              <TabsContent value="content">
                {editingContent && canEditContent ? (
                  <div className="space-y-4">
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="min-h-[400px] bg-white/10 border-white/20 text-white"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleContentUpdate} className="bg-green-600 hover:bg-green-700">
                        Save Changes
                      </Button>
                      <Button onClick={() => setEditingContent(false)} variant="outline">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <NoteContent
                    content={note.content || ''}
                    isLoading={false}
                  />
                )}
              </TabsContent>
              
              <TabsContent value="summary">
                <div className="bg-white/10 backdrop-blur-md border-white/20 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white text-lg font-semibold">Note Summary</h3>
                    {canGenerateSummary && (
                      <div className="flex gap-2">
                        {!note.summary && (
                          <Button
                            onClick={generateSummary}
                            disabled={generatingSummary}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            {generatingSummary ? 'Generating...' : 'Generate Summary'}
                          </Button>
                        )}
                        {note.summary && (
                          <Button
                            onClick={generateSummary}
                            disabled={generatingSummary}
                            variant="outline"
                            className="border-white/30 hover:bg-white/10 text-slate-950"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            {generatingSummary ? 'Re-generating...' : 'Re-summarize'}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {note.summary ? (
                    <div className="bg-white/5 rounded-lg p-4">
                      <p className="text-white whitespace-pre-wrap">{note.summary}</p>
                    </div>
                  ) : (
                    <div className="bg-white/5 rounded-lg p-4 text-center">
                      <p className="text-slate-400">
                        {generatingSummary ? 'Generating summary...' : canGenerateSummary ? 'No summary available. Click "Generate Summary" to create one.' : 'No summary available.'}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 md:space-y-6">
            <NoteMetadata
              sourceType={note.source_type}
              createdAt={note.created_at}
              duration={note.duration}
            />
            
            <NoteActions
              onDownload={handleDownload}
              onShare={handleShare}
              onCopy={handleCopy}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteEditor;
