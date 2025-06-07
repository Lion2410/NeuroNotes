
import React, { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface EditableTitleProps {
  title: string;
  onUpdate: (newTitle: string) => void;
  className?: string;
}

const EditableTitle: React.FC<EditableTitleProps> = ({ title, onUpdate, className = "" }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue.trim() && editValue !== title) {
      onUpdate(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-white/10 border-white/20 text-white text-2xl font-bold"
        />
        <Button onClick={handleSave} size="sm" className="bg-green-600 hover:bg-green-700">
          <Check className="h-4 w-4" />
        </Button>
        <Button onClick={handleCancel} size="sm" variant="outline" className="border-white/30">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 group ${className}`}>
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      <Button
        onClick={() => setIsEditing(true)}
        size="sm"
        variant="ghost"
        className="opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-white/10"
      >
        <Edit2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default EditableTitle;
