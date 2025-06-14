
import React, { useState, useEffect } from 'react';
import { Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Group {
  id: number;
  name: string;
  creator_id: string;
  created_at: string;
  member_count?: number;
  is_admin?: boolean;
}

interface GroupInviteDialogProps {
  group: Group | null;
  isOpen: boolean;
  onClose: () => void;
}

const GroupInviteDialog: React.FC<GroupInviteDialogProps> = ({
  group,
  isOpen,
  onClose
}) => {
  const [inviteLink, setInviteLink] = useState('');
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (group && isOpen) {
      createInviteLink();
    }
  }, [group, isOpen]);

  const createInviteLink = async () => {
    if (!group || !user) return;

    setCreating(true);
    try {
      // Generate a unique invite token
      const inviteToken = crypto.randomUUID();
      
      // Create invitation record
      const { error } = await supabase
        .from('invitations')
        .insert({
          group_id: group.id,
          invite_token: inviteToken,
          invited_by: user.id,
          status: 'pending'
        });

      if (error) throw error;

      // Generate the invite link
      const link = `${window.location.origin}/join-group?invite=${inviteToken}`;
      setInviteLink(link);
    } catch (error: any) {
      console.error('Error creating invite link:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create invite link.",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast({
      title: "Link Copied",
      description: "Invite link has been copied to clipboard."
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Invite Members to {group?.name}</DialogTitle>
          <DialogDescription className="text-slate-300">
            Share this link with anyone you want to invite to your group.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="invite-link" className="text-white">Shareable Invite Link</Label>
            <div className="flex gap-2">
              <Input
                id="invite-link"
                value={inviteLink}
                readOnly
                className="bg-slate-700 border-slate-600 text-white"
                placeholder={creating ? "Generating invite link..." : ""}
              />
              <Button 
                onClick={copyInviteLink} 
                disabled={!inviteLink}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-slate-400 mt-2">
              Anyone with this link can join your group after registering or signing in.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupInviteDialog;
