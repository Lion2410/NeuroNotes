
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TranscriptContentProps {
  content: string;
  isLoading: boolean;
}

const TranscriptContent: React.FC<TranscriptContentProps> = ({ content, isLoading }) => {
  if (isLoading) {
    return (
      <Card className="bg-white/10 backdrop-blur-md border-white/20">
        <CardContent className="p-4 md:p-6">
          <div className="text-center text-white">Loading note...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20">
      <CardHeader className="p-4 md:p-6 pb-2 md:pb-4">
        <CardTitle className="text-white text-base md:text-lg">Note Content</CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0">
        <div className="bg-white/5 rounded-lg p-3 md:p-6 max-h-64 md:max-h-96 overflow-y-auto">
          <pre className="text-white whitespace-pre-wrap font-sans text-sm md:text-base">
            {content || 'No note content available.'}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
};

export default TranscriptContent;
