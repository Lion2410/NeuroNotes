
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Plus, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UserTranscription {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  source_type: string;
  duration: number | null;
}

interface AddNotesToGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: number;
  groupName: string;
  onNotesAdded: () => void;
}

const AddNotesToGroupDialog: React.FC<AddNotesToGroupDialogProps> = ({
  isOpen,
  onClose,
  groupId,
  groupName,
  onNotesAdded
}) => {
  const [userTranscriptions, setUserTranscriptions] = useState<UserTranscription[]>([]);
  const [selectedTranscriptions, setSelectedTranscriptions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen && user) {
      fetchUserTranscriptions();
    }
  }, [isOpen, user]);

  const fetchUserTranscriptions = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get user's transcriptions that aren't already in this group
      const { data: existingGroupNotes, error: existingError } = await supabase
        .from('group_notes')
        .select('transcription_id')
        .eq('group_id', groupId);

      if (existingError) throw existingError;

      const existingTranscriptionIds = existingGroupNotes?.map(note => note.transcription_id) || [];

      const { data: transcriptions, error } = await supabase
        .from('transcriptions')
        .select('id, title, content, created_at, source_type, duration')
        .eq('user_id', user.id)
        .not('id', 'in', `(${existingTranscriptionIds.length > 0 ? existingTranscriptionIds.join(',') : 'null'})`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUserTranscriptions(transcriptions || []);
    } catch (error: any) {
      console.error('Error fetching user transcriptions:', error);
      toast({
        title: "Error",
        description: "Failed to load your notes.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTranscriptionToggle = (transcriptionId: string, checked: boolean) => {
    const newSelected = new Set(selectedTranscriptions);
    if (checked) {
      newSelected.add(transcriptionId);
    } else {
      newSelected.delete(transcriptionId);
    }
    setSelectedTranscriptions(newSelected);
  };

  const handleAddNotes = async () => {
    if (selectedTranscriptions.size === 0) {
      toast({
        title: "No Notes Selected",
        description: "Please select at least one note to add to the group.",
        variant: "destructive"
      });
      return;
    }

    setAdding(true);
    try {
      console.log('Adding note references to group:', { groupId, selectedCount: selectedTranscriptions.size });
      
      // Create references in the group_notes junction table
      const selectedTranscriptionIds = Array.from(selectedTranscriptions);
      const notesToInsert = selectedTranscriptionIds.map(transcriptionId => ({
        group_id: groupId,
        transcription_id: transcriptionId,
        added_by: user!.id
      }));

      console.log('Note references to insert:', notesToInsert);

      const { data, error } = await supabase
        .from('group_notes')
        .insert(notesToInsert)
        .select();

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }

      console.log('Successfully inserted note references:', data);

      toast({
        title: "Notes Added Successfully",
        description: `Successfully added ${selectedTranscriptionIds.length} note(s) to ${groupName}.`
      });

      onNotesAdded();
      onClose();
      setSelectedTranscriptions(new Set());
    } catch (error: any) {
      console.error('Error adding notes to group:', error);
      
      // Provide more specific error messages
      let errorMessage = "Failed to add notes to group.";
      if (error.message?.includes('row-level security')) {
        errorMessage = "Permission denied. You may not be a member of this group.";
      } else if (error.message?.includes('foreign key')) {
        errorMessage = "Invalid group or user reference.";
      } else if (error.message?.includes('duplicate key')) {
        errorMessage = "Some of these notes are already in the group.";
      }
      
      toast({
        title: "Error Adding Notes",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    setSelectedTranscriptions(new Set());
    onClose();
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'Unknown';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Notes to {groupName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">Loading your notes...</div>
          ) : userTranscriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <p>No notes available to add.</p>
              <p className="text-sm">Either you haven't created any notes yet, or all your notes are already in this group.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <AlertCircle className="h-4 w-4" />
                <span>Select notes from your dashboard to add references to the group.</span>
              </div>
              
              <div className="grid gap-3 max-h-96 overflow-y-auto">
                {userTranscriptions.map((transcription) => (
                  <Card key={transcription.id} className="cursor-pointer hover:bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedTranscriptions.has(transcription.id)}
                          onCheckedChange={(checked) => handleTranscriptionToggle(transcription.id, !!checked)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium truncate">{transcription.title}</h4>
                            <Badge variant="secondary" className="text-xs">
                              {transcription.source_type}
                            </Badge>
                          </div>
                          {transcription.content && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {transcription.content.substring(0, 150)}...
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              Created {new Date(transcription.created_at).toLocaleDateString()}
                            </span>
                            {transcription.duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(transcription.duration)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  {selectedTranscriptions.size} note(s) selected
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddNotes}
                    disabled={selectedTranscriptions.size === 0 || adding}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {adding ? 'Adding...' : `Add ${selectedTranscriptions.size} Reference(s)`}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddNotesToGroupDialog;
