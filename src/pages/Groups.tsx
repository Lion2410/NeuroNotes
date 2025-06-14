
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import CreateGroupDialog from '@/components/groups/CreateGroupDialog';
import JoinGroupTab from '@/components/groups/JoinGroupTab';
import GroupsList from '@/components/groups/GroupsList';
import GroupsHeader from '@/components/groups/GroupsHeader';

interface GroupWithStats {
  id: number;
  name: string;
  creator_id: string;
  created_at: string;
  member_count: number;
  is_admin: boolean;
}

const Groups: React.FC = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use the optimized view for better performance
  const { data: groups = [], isLoading, error, refetch } = useQuery({
    queryKey: ['user-groups', user?.id],
    queryFn: async (): Promise<GroupWithStats[]> => {
      if (!user) throw new Error('User not authenticated');

      console.log('Fetching groups using optimized view...');
      
      // Use the optimized view that joins data efficiently
      const { data, error } = await supabase
        .from('user_groups_with_stats')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching groups:', error);
        throw error;
      }

      console.log('Groups fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!user,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false
  });

  const handleCreateGroup = () => {
    setCreateDialogOpen(true);
  };

  const handleGroupCreated = () => {
    // Invalidate and refetch groups
    queryClient.invalidateQueries({ queryKey: ['user-groups'] });
    setCreateDialogOpen(false);
    toast({
      title: "Success",
      description: "Group created successfully!"
    });
  };

  const handleRefresh = () => {
    refetch();
  };

  if (error) {
    console.error('Error in Groups component:', error);
    return (
      <div className="min-h-screen relative">
        {/* Fixed Background */}
        <div 
          className="fixed inset-0 z-0"
          style={{
            background: 'linear-gradient(to bottom right, #201840 0%, #551B83 47%, #1E092F 100%)'
          }}
        />
        
        {/* Content Layer */}
        <div className="relative z-10">
          <GroupsHeader />
          <div className="container mx-auto px-4 py-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-400 mb-4">Error Loading Groups</h2>
              <p className="text-slate-300 mb-4">
                {error instanceof Error ? error.message : 'Failed to load groups'}
              </p>
              <Button onClick={handleRefresh} className="bg-purple-600 hover:bg-purple-700">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Fixed Background */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          background: 'linear-gradient(to bottom right, #201840 0%, #551B83 47%, #1E092F 100%)'
        }}
      />
      
      {/* Content Layer */}
      <div className="relative z-10">
        <GroupsHeader />

        <div className="container mx-auto px-4 py-8">
          <Tabs defaultValue="my-groups" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 bg-white/10 border-white/20">
              <TabsTrigger value="my-groups" className="flex items-center gap-2 text-white data-[state=active]:bg-white/20 data-[state=active]:text-white">
                <Users className="h-4 w-4" />
                My Groups
              </TabsTrigger>
              <TabsTrigger value="join-group" className="flex items-center gap-2 text-white data-[state=active]:bg-white/20 data-[state=active]:text-white">
                <UserPlus className="h-4 w-4" />
                Join Group
              </TabsTrigger>
            </TabsList>

            <TabsContent value="my-groups">
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-white">My Groups</CardTitle>
                      <CardDescription className="text-slate-300">
                        Groups you've created or joined
                      </CardDescription>
                    </div>
                    <Button 
                      onClick={handleCreateGroup}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Group
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                      <p className="text-white">Loading groups...</p>
                    </div>
                  ) : (
                    <GroupsList 
                      groups={groups} 
                      onRefresh={handleRefresh}
                      onCreateGroup={handleCreateGroup}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="join-group">
              <JoinGroupTab onJoinSuccess={handleRefresh} />
            </TabsContent>
          </Tabs>

          <CreateGroupDialog
            isOpen={createDialogOpen}
            onClose={() => setCreateDialogOpen(false)}
            onGroupCreated={handleGroupCreated}
          />
        </div>
      </div>
    </div>
  );
};

export default Groups;
