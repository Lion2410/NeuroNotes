
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface NoteContentProps {
  content: string;
  isLoading: boolean;
}

const NoteContent: React.FC<NoteContentProps> = ({ content, isLoading }) => {
  if (isLoading) {
    return (
      <Card className="bg-white/10 backdrop-blur-md border-white/20">
        <CardContent className="p-3 sm:p-4 md:p-6">
          <div className="text-center text-white text-sm sm:text-base">Loading note...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20">
      <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 md:pb-4">
        <CardTitle className="text-white text-sm sm:text-base md:text-lg">Note Content</CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
        <div className="bg-white/5 rounded-lg p-2 sm:p-3 md:p-6 max-h-48 sm:max-h-64 md:max-h-96 overflow-y-auto">
          <pre className="text-white whitespace-pre-wrap font-sans text-xs sm:text-sm md:text-base">
            {content || 'No note content available.'}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
};

export default NoteContent;
