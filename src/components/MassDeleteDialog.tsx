import React, { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  source_type: string;
  duration: number | null;
}
interface MassDeleteDialogProps {
  notes: Note[];
  onNotesDeleted: () => void;
}
const MassDeleteDialog: React.FC<MassDeleteDialogProps> = ({
  notes,
  onNotesDeleted
}) => {
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const {
    toast
  } = useToast();
  const handleSelectAll = () => {
    if (selectedNotes.size === notes.length) {
      setSelectedNotes(new Set());
    } else {
      setSelectedNotes(new Set(notes.map(note => note.id)));
    }
  };
  const handleSelectNote = (noteId: string) => {
    const newSelected = new Set(selectedNotes);
    if (newSelected.has(noteId)) {
      newSelected.delete(noteId);
    } else {
      newSelected.add(noteId);
    }
    setSelectedNotes(newSelected);
  };
  const handleMassDelete = async () => {
    if (selectedNotes.size === 0) return;
    setIsDeleting(true);
    try {
      const {
        error
      } = await supabase.from('transcriptions').delete().in('id', Array.from(selectedNotes));
      if (error) throw error;
      toast({
        title: "Notes Deleted",
        description: `${selectedNotes.size} note(s) have been deleted successfully.`
      });
      setSelectedNotes(new Set());
      setIsOpen(false);
      onNotesDeleted();
    } catch (error) {
      console.error('Error deleting notes:', error);
      toast({
        title: "Error",
        description: "Failed to delete notes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };
  return <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-red-500/50 hover:bg-red-500/20 text-red-400 hover:text-red-300">
          <Trash2 className="h-4 w-4 mr-2" />
          Mass Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Delete Multiple Notes</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button onClick={handleSelectAll} variant="outline" size="sm" className="border-gray-600/50 hover:bg-gray-800/50 text-slate-950">
              {selectedNotes.size === notes.length ? 'Deselect All' : 'Select All'}
            </Button>
            <span className="text-gray-400 text-sm">
              {selectedNotes.size} of {notes.length} selected
            </span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {notes.map(note => <div key={note.id} className="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors">
                <Checkbox checked={selectedNotes.has(note.id)} onCheckedChange={() => handleSelectNote(note.id)} />
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium truncate">{note.title}</h4>
                  <p className="text-gray-400 text-sm">
                    {new Date(note.created_at).toLocaleDateString()} • {note.source_type}
                  </p>
                </div>
              </div>)}
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <Button onClick={handleMassDelete} disabled={selectedNotes.size === 0 || isDeleting} variant="destructive" className="flex-1 bg-red-600 hover:bg-red-700">
              {isDeleting ? <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </> : <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {selectedNotes.size} Note(s)
                </>}
            </Button>
            <Button onClick={() => setIsOpen(false)} variant="outline" className="border-gray-600/50 hover:bg-gray-800/50 text-gray-300 hover:text-white">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>;
};
export default MassDeleteDialog;