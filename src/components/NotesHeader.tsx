
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';

interface NotesHeaderProps {
  onBack: () => void;
  onCreateNote: () => void;
  showMassDelete?: boolean;
  massDeleteComponent?: React.ReactNode;
}

const NotesHeader: React.FC<NotesHeaderProps> = ({ 
  onBack, 
  onCreateNote, 
  showMassDelete = false, 
  massDeleteComponent 
}) => {
  return (
    <div className="bg-purple-900/50 backdrop-blur-sm border-b border-purple-700/30 sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Back Button */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <h1 className="text-2xl font-bold text-white">Notes</h1>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {showMassDelete && massDeleteComponent}
            <Button 
              onClick={onCreateNote}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Note
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesHeader;
