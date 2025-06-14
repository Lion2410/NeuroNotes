
import React from 'react';
import { Button } from '@/components/ui/button';
import { Users, UserPlus } from 'lucide-react';

interface Group {
  id: number;
  name: string;
  creator_id: string;
  created_at: string;
  member_count?: number;
  is_admin?: boolean;
}

interface GroupsListProps {
  groups: Group[];
  onRefresh: () => void;
  onCreateGroup?: () => void;
}

const GroupsList: React.FC<GroupsListProps> = ({ groups, onRefresh, onCreateGroup }) => {
  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-16 w-16 text-slate-400 mx-auto mb-4" />
        <h3 className="text-2xl font-semibold text-white mb-2">No Groups Yet</h3>
        <p className="text-slate-300 mb-6">Create your first group to start collaborating with others.</p>
        <Button 
          onClick={onCreateGroup}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Create Group
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <div key={group.id} className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">{group.name}</h3>
              <p className="text-slate-300 text-sm">
                {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
              </p>
            </div>
            {group.is_admin && (
              <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded">
                Admin
              </span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">
              Created {new Date(group.created_at).toLocaleDateString()}
            </span>
            <Button variant="outline" size="sm" className="border-white/30 hover:bg-white/10 text-white">
              View
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GroupsList;
