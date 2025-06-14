
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UserNote {
  id: number;
  title: string;
  content: string | null;
  created_at: string;
  is_private: boolean;
  group_id: number | null;
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
  const [userNotes, setUserNotes] = useState<UserNote[]>([]);
  const [selectedNotes, setSelectedNotes] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen && user) {
      fetchUserNotes();
    }
  }, [isOpen, user]);

  const fetchUserNotes = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get user's notes that are either not in any group or in a different group
      const { data: notes, error } = await supabase
        .from('notes')
        .select('id, title, content, created_at, is_private, group_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out notes that are already in this group
      const availableNotes = notes?.filter(note => note.group_id !== groupId) || [];
      setUserNotes(availableNotes);
    } catch (error: any) {
      console.error('Error fetching user notes:', error);
      toast({
        title: "Error",
        description: "Failed to load your notes.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNoteToggle = (noteId: number, checked: boolean) => {
    const newSelected = new Set(selectedNotes);
    if (checked) {
      newSelected.add(noteId);
    } else {
      newSelected.delete(noteId);
    }
    setSelectedNotes(newSelected);
  };

  const handleAddNotes = async () => {
    if (selectedNotes.size === 0) {
      toast({
        title: "No Notes Selected",
        description: "Please select at least one note to add to the group.",
        variant: "destructive"
      });
      return;
    }

    setAdding(true);
    try {
      // Update selected notes to belong to this group
      const noteIds = Array.from(selectedNotes);
      const { error } = await supabase
        .from('notes')
        .update({ group_id: groupId })
        .in('id', noteIds);

      if (error) throw error;

      toast({
        title: "Notes Added",
        description: `Successfully added ${noteIds.length} note(s) to ${groupName}.`
      });

      onNotesAdded();
      onClose();
      setSelectedNotes(new Set());
    } catch (error: any) {
      console.error('Error adding notes to group:', error);
      toast({
        title: "Error",
        description: "Failed to add notes to group.",
        variant: "destructive"
      });
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    setSelectedNotes(new Set());
    onClose();
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
          ) : userNotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <p>No available notes to add.</p>
              <p className="text-sm">All your notes are either already in this group or you haven't created any notes yet.</p>
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground mb-4">
                Select notes to add to the group. Notes already in this group are not shown.
              </div>
              
              <div className="grid gap-3 max-h-96 overflow-y-auto">
                {userNotes.map((note) => (
                  <Card key={note.id} className="cursor-pointer hover:bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedNotes.has(note.id)}
                          onCheckedChange={(checked) => handleNoteToggle(note.id, !!checked)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium truncate">{note.title}</h4>
                            <div className="flex gap-1">
                              {note.is_private && (
                                <Badge variant="outline" className="text-xs">
                                  Private
                                </Badge>
                              )}
                              {note.group_id && note.group_id !== groupId && (
                                <Badge variant="secondary" className="text-xs">
                                  In Other Group
                                </Badge>
                              )}
                            </div>
                          </div>
                          {note.content && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {note.content}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Created {new Date(note.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  {selectedNotes.size} note(s) selected
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddNotes}
                    disabled={selectedNotes.size === 0 || adding}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {adding ? 'Adding...' : `Add ${selectedNotes.size} Note(s)`}
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
