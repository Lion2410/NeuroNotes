
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
        <CardContent className="p-6">
          <div className="text-center text-white">Loading transcript...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20">
      <CardHeader>
        <CardTitle className="text-white">Transcript</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-white/5 rounded-lg p-6 max-h-96 overflow-y-auto">
          <pre className="text-white whitespace-pre-wrap font-sans">
            {content || 'No transcript content available.'}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
};

export default TranscriptContent;
