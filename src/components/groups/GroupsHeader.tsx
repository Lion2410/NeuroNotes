
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
    <div className="mb-8">
      <div className="flex items-center gap-4 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
      <h1 className="text-4xl font-bold text-white mb-2">Groups</h1>
      <p className="text-slate-300">
        Collaborate with others by creating or joining groups
      </p>
    </div>
  );
};

export default GroupsHeader;
