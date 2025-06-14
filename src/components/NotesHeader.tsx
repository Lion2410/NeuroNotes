
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Home, ChevronRight } from 'lucide-react';

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
          {/* Logo and Navigation */}
          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-gray-300 hover:bg-gray-800/50 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">N</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">NeuroNotes</h1>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Home className="h-3 w-3" />
                  <span>Dashboard</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-white">Notes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {showMassDelete && massDeleteComponent}
            <Button 
              onClick={onCreateNote}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6"
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
