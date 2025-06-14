
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Group {
  id: number;
  name: string;
  creator_id: string;
  created_at: string;
  member_count?: number;
  is_admin?: boolean;
}

interface GroupSettingsDialogProps {
  group: Group | null;
  isOpen: boolean;
  onClose: () => void;
  onGroupUpdated: () => void;
}

const GroupSettingsDialog: React.FC<GroupSettingsDialogProps> = ({
  group,
  isOpen,
  onClose,
  onGroupUpdated
}) => {
  const [groupName, setGroupName] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (group) {
      setGroupName(group.name);
    }
  }, [group]);

  const handleSave = async () => {
    if (!group || !groupName.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('groups')
        .update({ name: groupName.trim() })
        .eq('id', group.id);

      if (error) throw error;

      toast({
        title: "Group Updated",
        description: "Group settings have been saved successfully."
      });

      onGroupUpdated();
      onClose();
    } catch (error: any) {
      console.error('Error updating group:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update group.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Group Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="group-name" className="text-white">Group Name</Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-white/10 border-white/20 text-white"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="border-white/30 hover:bg-white/10 text-slate-950"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={saving || !groupName.trim()}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupSettingsDialog;
