
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const GroupsHeader: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/dashboard');
  };

  return (
    <div 
      className="backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-20"
      style={{
        background: 'linear-gradient(to bottom right, #2E3048 0%, #4E3171 47%, #683391 100%)'
      }}
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
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
              <span className="text-lg">Groups</span>
            </div>
          </div>
        </div>
        
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Groups</h1>
          <p className="text-slate-300">
            Collaborate with others by creating or joining groups
          </p>
        </div>
      </div>
    </div>
  );
};

export default GroupsHeader;
