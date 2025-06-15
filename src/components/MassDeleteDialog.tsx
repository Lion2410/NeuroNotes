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
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}

const MassDeleteDialog: React.FC<MassDeleteDialogProps> = ({
  notes,
  onNotesDeleted,
  isOpen: controlledOpen,
  setIsOpen: setControlledOpen
}) => {
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  // when controlledOpen/setControlledOpen are provided, use them, otherwise fallback to internal state
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setIsOpen = setControlledOpen !== undefined ? setControlledOpen : setUncontrolledOpen;

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
      const { error } = await supabase.from('transcriptions').delete().in('id', Array.from(selectedNotes));
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {/* Only render the DialogTrigger if running in uncontrolled mode */}
      {setControlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="outline" className="border-red-500/50 hover:bg-red-500/20 text-red-400 hover:text-red-300">
            <Trash2 className="h-4 w-4 mr-2" />
            Mass Delete
          </Button>
        </DialogTrigger>
      )}
      <DialogContent 
        className="bg-gray-950 border-gray-800 max-w-md w-full sm:max-w-lg p-4 sm:p-5 rounded-xl shadow-xl space-y-3"
        aria-describedby="mass-delete-description"
      >
        <DialogHeader>
          <DialogTitle className="text-white text-lg sm:text-xl font-semibold mb-1">
            Delete Multiple Notes
          </DialogTitle>
        </DialogHeader>
        {/* Description for accessibility */}
        <div id="mass-delete-description" className="sr-only">
          Select notes to delete. Deleted notes cannot be recovered.
        </div>
        <div className="flex items-center justify-between mb-1">
          <Button
            onClick={handleSelectAll}
            variant="outline"
            size="sm"
            className="border-gray-700 hover:bg-gray-900 text-slate-950 dark:text-gray-100 px-3"
          >
            {selectedNotes.size === notes.length ? 'Deselect All' : 'Select All'}
          </Button>
          <span className="text-gray-400 text-xs sm:text-sm">
            {selectedNotes.size} of {notes.length} selected
          </span>
        </div>

        <div className="space-y-1 max-h-[42vh] min-h-[2rem] overflow-y-auto px-1">
          {notes.map(note => (
            <div
              key={note.id}
              className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-900/60 transition"
            >
              <Checkbox
                checked={selectedNotes.has(note.id)}
                onCheckedChange={() => handleSelectNote(note.id)}
                className="scale-90"
              />
              <div className="flex-1 min-w-0 overflow-hidden">
                <h4 className="text-white text-xs font-semibold truncate">{note.title}</h4>
                <p className="text-gray-400 text-[11px] truncate">
                  {new Date(note.created_at).toLocaleDateString()} &bull; {note.source_type}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2 border-t border-gray-800">
          <Button
            onClick={handleMassDelete}
            disabled={selectedNotes.size === 0 || isDeleting}
            variant="destructive"
            className="flex-1 bg-red-600 hover:bg-red-700 py-2 text-sm"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete {selectedNotes.size} 
                {selectedNotes.size === 1 ? ' Note' : ' Notes'}
              </>
            )}
          </Button>
          <Button
            onClick={() => setIsOpen(false)}
            variant="outline"
            className="border-gray-700 hover:bg-gray-900 text-gray-300 hover:text-white flex-1 py-2 text-sm"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MassDeleteDialog;
