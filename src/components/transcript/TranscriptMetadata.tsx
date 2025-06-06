
import React from 'react';
import { Calendar, Clock, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TranscriptMetadataProps {
  sourceType: string;
  createdAt: string;
  duration?: number;
}

const TranscriptMetadata: React.FC<TranscriptMetadataProps> = ({
  sourceType,
  createdAt,
  duration
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSourceLabel = (type: string) => {
    switch (type) {
      case 'upload':
        return 'File Upload';
      case 'live_meeting':
        return 'Live Meeting';
      default:
        return 'Unknown';
    }
  };

  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20">
      <CardHeader>
        <CardTitle className="text-white">Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-purple-400" />
          <span className="text-slate-300">Source:</span>
          <Badge variant="secondary" className="bg-purple-600/20 text-purple-300">
            {getSourceLabel(sourceType)}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-400" />
          <span className="text-slate-300">Created:</span>
          <span className="text-white">{formatDate(createdAt)}</span>
        </div>
        
        {duration && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-green-400" />
            <span className="text-slate-300">Duration:</span>
            <span className="text-white">{formatDuration(duration)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TranscriptMetadata;
