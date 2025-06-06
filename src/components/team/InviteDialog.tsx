
import React from 'react';
import { Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InviteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  inviteLink: string;
  onCopyLink: () => void;
}

const InviteDialog: React.FC<InviteDialogProps> = ({
  isOpen,
  onClose,
  inviteLink,
  onCopyLink
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Invite Team Member</DialogTitle>
          <DialogDescription className="text-slate-300">
            Share this link with anyone you want to invite to your team.
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
              />
              <Button onClick={onCopyLink} className="bg-purple-600 hover:bg-purple-700">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-slate-400 mt-2">
              Anyone with this link can join your team after registering or signing in.
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

export default InviteDialog;
