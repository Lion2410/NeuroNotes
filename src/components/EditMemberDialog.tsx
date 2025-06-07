
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  user_id: string;
  team_id: string;
  avatar_url?: string;
}

interface EditMemberDialogProps {
  member: TeamMember | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (member: TeamMember) => Promise<void>;
}

const EditMemberDialog: React.FC<EditMemberDialogProps> = ({
  member,
  isOpen,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'member',
    status: 'active'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.name,
        email: member.email,
        role: member.role,
        status: member.status
      });
    } else {
      setFormData({
        name: '',
        email: '',
        role: 'member',
        status: 'active'
      });
    }
  }, [member]);

  const handleSave = async () => {
    if (member) {
      setSaving(true);
      try {
        await onSave({
          ...member,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          status: formData.status
        });
        onClose();
      } catch (error) {
        console.error('Error saving member:', error);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle>Edit Team Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-white">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="bg-white/10 border-white/20 text-white"
            />
          </div>
          <div>
            <Label htmlFor="email" className="text-white">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="bg-white/10 border-white/20 text-white"
            />
          </div>
          <div>
            <Label htmlFor="role" className="text-white">Role</Label>
            <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="admin" className="text-white">Admin</SelectItem>
                <SelectItem value="moderator" className="text-white">Moderator</SelectItem>
                <SelectItem value="member" className="text-white">Member</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="status" className="text-white">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="active" className="text-white">Active</SelectItem>
                <SelectItem value="inactive" className="text-white">Inactive</SelectItem>
                <SelectItem value="pending" className="text-white">Pending</SelectItem>
              </SelectContent>
            </Select>
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
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditMemberDialog;
