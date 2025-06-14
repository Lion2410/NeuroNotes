
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface CreateGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: () => void;
}

interface FormData {
  groupName: string;
}

const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({
  isOpen,
  onClose,
  onGroupCreated
}) => {
  const form = useForm<FormData>({
    defaultValues: {
      groupName: ''
    }
  });

  const { user } = useAuth();
  const { toast } = useToast();

  const onSubmit = async (data: FormData) => {
    if (!data.groupName.trim() || !user) return;

    try {
      const { error } = await supabase
        .from('groups')
        .insert({
          name: data.groupName.trim(),
          creator_id: user.id
        });

      if (error) throw error;

      form.reset();
      onClose();
      onGroupCreated();
      
      toast({
        title: "Success",
        description: "Group created successfully!"
      });
    } catch (error) {
      console.error('Error creating group:', error);
      toast({
        title: "Error",
        description: "Failed to create group. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Create New Group</DialogTitle>
          <DialogDescription className="text-slate-300">
            Create a new group to collaborate and share notes with others.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField 
              control={form.control} 
              name="groupName" 
              rules={{
                required: "Group name is required",
                minLength: {
                  value: 2,
                  message: "Group name must be at least 2 characters"
                },
                maxLength: {
                  value: 50,
                  message: "Group name must be less than 50 characters"
                }
              }} 
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Group Name</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Enter group name..." 
                      className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" 
                    />
                  </FormControl>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )} 
            />
            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose} 
                className="border-white/30 hover:bg-white/10 text-slate-950"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={form.formState.isSubmitting} 
                className="bg-purple-600 hover:bg-purple-700"
              >
                {form.formState.isSubmitting ? 'Creating...' : 'Create Group'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupDialog;
