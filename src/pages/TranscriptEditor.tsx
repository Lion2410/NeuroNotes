
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import EditableTitle from '@/components/EditableTitle';
import TranscriptContent from '@/components/transcript/TranscriptContent';
import TranscriptActions from '@/components/transcript/TranscriptActions';
import TranscriptMetadata from '@/components/transcript/TranscriptMetadata';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface Transcription {
  id: string;
  title: string;
  content: string;
  summary: string;
  source_type: string;
  created_at: string;
  duration?: number;
}

const TranscriptEditor = () => {
  const { id } = useParams<{ id: string }>();
  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [editingContent, setEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (id && user) {
      fetchTranscription();
    }
  }, [id, user]);

  const fetchTranscription = async () => {
    try {
      const { data, error } = await supabase
        .from('transcriptions')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setTranscription(data);
      setEditedContent(data.content || '');
    } catch (error) {
      console.error('Error fetching note:', error);
      toast({
        title: "Error",
        description: "Failed to load note.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTitleUpdate = async (newTitle: string) => {
    if (!transcription) return;

    try {
      const { error } = await supabase
        .from('transcriptions')
        .update({ title: newTitle })
        .eq('id', transcription.id);

      if (error) throw error;

      setTranscription(prev => prev ? { ...prev, title: newTitle } : null);
      
      toast({
        title: "Title Updated",
        description: "Note title has been updated successfully."
      });
    } catch (error) {
      console.error('Error updating title:', error);
      toast({
        title: "Error",
        description: "Failed to update title.",
        variant: "destructive"
      });
    }
  };

  const generateSummary = async () => {
    if (!transcription?.content) return;

    setGeneratingSummary(true);
    try {
      const response = await supabase.functions.invoke('generate-summary-hf', {
        body: { content: transcription.content }
      });

      if (response.error) throw response.error;

      const { summary } = response.data;

      const { error } = await supabase
        .from('transcriptions')
        .update({ summary })
        .eq('id', transcription.id);

      if (error) throw error;

      setTranscription(prev => prev ? { ...prev, summary } : null);

      toast({
        title: "Summary Generated",
        description: "Summary has been generated and saved successfully."
      });
    } catch (error) {
      console.error('Error generating summary:', error);
      toast({
        title: "Error",
        description: "Failed to generate summary. Please try again.",
        variant: "destructive"
      });
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleContentUpdate = async () => {
    if (!transcription) return;

    try {
      const { error } = await supabase
        .from('transcriptions')
        .update({ content: editedContent })
        .eq('id', transcription.id);

      if (error) throw error;

      setTranscription(prev => prev ? { ...prev, content: editedContent } : null);
      setEditingContent(false);

      toast({
        title: "Content Updated",
        description: "Note content has been updated successfully."
      });
    } catch (error) {
      console.error('Error updating content:', error);
      toast({
        title: "Error",
        description: "Failed to update content.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    if (!transcription) return;

    try {
      const { error } = await supabase
        .from('transcriptions')
        .delete()
        .eq('id', transcription.id);

      if (error) throw error;

      toast({
        title: "Note Deleted",
        description: "Note has been deleted successfully."
      });

      window.location.href = '/notes';
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: "Error",
        description: "Failed to delete note.",
        variant: "destructive"
      });
    }
  };

  const handleDownload = () => {
    if (!transcription) return;
    
    const element = document.createElement('a');
    const file = new Blob([transcription.content || ''], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${transcription.title}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    
    toast({
      title: "Download Started",
      description: "Your transcript is being downloaded."
    });
  };

  const handleShare = () => {
    if (navigator.share && transcription) {
      navigator.share({
        title: transcription.title,
        text: transcription.content,
        url: window.location.href
      });
    } else {
      toast({
        title: "Share",
        description: "Copy the URL to share this transcript."
      });
    }
  };

  const handleCopy = () => {
    if (!transcription?.content) return;
    
    navigator.clipboard.writeText(transcription.content);
    toast({
      title: "Copied",
      description: "Transcript has been copied to clipboard."
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-white">Loading note...</div>
      </div>
    );
  }

  if (!transcription) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-white">Note not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black">
      {/* Header */}
      <header className="px-4 md:px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 md:space-x-4">
            <Link to="/notes" className="text-white hover:text-purple-400 transition-colors">
              <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
            </Link>
            <div className="flex items-center space-x-2">
              <img src="/lovable-uploads/82423172-8fa2-4a61-9691-e45ac0c5f57c.png" alt="NeuroNotes" className="h-8 md:h-12 w-auto" />
              <span className="text-lg md:text-2xl font-bold text-white">NeuroNotes</span>
            </div>
            <span className="text-slate-400 hidden md:block">/</span>
            <EditableTitle
              title={transcription.title}
              onUpdate={handleTitleUpdate}
              className="text-white font-medium text-sm md:text-base"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingContent(true)}
              className="border-white/30 hover:bg-white/10 text-slate-950"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-500/30 hover:bg-red-500/10 text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Delete Note</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-slate-300">Are you sure you want to delete this note? This action cannot be undone.</p>
                  <div className="flex gap-2">
                    <Button onClick={handleDelete} variant="destructive">Delete</Button>
                    <Button onClick={() => setShowDeleteDialog(false)} variant="outline">Cancel</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8">
        <div className="grid lg:grid-cols-3 gap-4 md:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-white/10 mb-4">
                <TabsTrigger value="content" className="text-white data-[state=active]:bg-purple-600">Content</TabsTrigger>
                <TabsTrigger value="summary" className="text-white data-[state=active]:bg-purple-600">Summary</TabsTrigger>
              </TabsList>
              
              <TabsContent value="content">
                {editingContent ? (
                  <div className="space-y-4">
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="min-h-[400px] bg-white/10 border-white/20 text-white"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleContentUpdate} className="bg-green-600 hover:bg-green-700">
                        Save Changes
                      </Button>
                      <Button onClick={() => setEditingContent(false)} variant="outline">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <TranscriptContent
                    content={transcription.content || ''}
                    isLoading={false}
                  />
                )}
              </TabsContent>
              
              <TabsContent value="summary">
                <div className="bg-white/10 backdrop-blur-md border-white/20 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white text-lg font-semibold">Note Summary</h3>
                    <div className="flex gap-2">
                      {!transcription.summary && (
                        <Button
                          onClick={generateSummary}
                          disabled={generatingSummary}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          {generatingSummary ? 'Generating...' : 'Generate Summary'}
                        </Button>
                      )}
                      {transcription.summary && (
                        <Button
                          onClick={generateSummary}
                          disabled={generatingSummary}
                          variant="outline"
                          className="border-white/30 hover:bg-white/10 text-slate-950"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          {generatingSummary ? 'Re-generating...' : 'Re-summarize'}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {transcription.summary ? (
                    <div className="bg-white/5 rounded-lg p-4">
                      <p className="text-white whitespace-pre-wrap">{transcription.summary}</p>
                    </div>
                  ) : (
                    <div className="bg-white/5 rounded-lg p-4 text-center">
                      <p className="text-slate-400">
                        {generatingSummary ? 'Generating summary...' : 'No summary available. Click "Generate Summary" to create one.'}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 md:space-y-6">
            <TranscriptMetadata
              sourceType={transcription.source_type}
              createdAt={transcription.created_at}
              duration={transcription.duration}
            />
            
            <TranscriptActions
              onDownload={handleDownload}
              onShare={handleShare}
              onCopy={handleCopy}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptEditor;
