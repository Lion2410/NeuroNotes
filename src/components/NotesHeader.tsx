
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
    <div 
      className="backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-10"
      style={{
        background: 'linear-gradient(to bottom, #e570e7 0%, #c85ec7 47%, #a849a3 100%)'
      }}
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Back button and branding */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-white hover:bg-white/10 hover:text-white p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center">
                <img 
                  src="/lovable-uploads/a5a042c4-e054-4df2-b3b5-8ae8386c5f2b.png" 
                  alt="NeuroNotes Logo" 
                  className="w-8 h-8 object-contain"
                />
              </div>
              <div className="flex items-center gap-2 text-white">
                <span className="text-xl font-semibold">NeuroNotes</span>
                <span className="text-white/70">/</span>
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
