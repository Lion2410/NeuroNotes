
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

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
    <div className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-10">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Back button and branding */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-gray-300 hover:bg-gray-800/50 hover:text-white p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-teal-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">N</span>
              </div>
              <div className="flex items-center gap-2 text-white">
                <span className="text-xl font-semibold">NeuroNotes</span>
                <span className="text-gray-400">/</span>
                <span className="text-lg">All Notes</span>
              </div>
            </div>
          </div>

          {/* Right side - Action buttons */}
          <div className="flex items-center gap-3">
            {showMassDelete && massDeleteComponent}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesHeader;
