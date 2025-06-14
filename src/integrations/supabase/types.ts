export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      group_members: {
        Row: {
          group_id: number
          id: number
          is_admin: boolean
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: number
          id?: number
          is_admin?: boolean
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: number
          id?: number
          is_admin?: boolean
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          creator_id: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: number
          name: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string
          group_id: number
          id: number
          invite_token: string
          invited_by: string
          status: string
        }
        Insert: {
          created_at?: string
          group_id: number
          id?: number
          invite_token: string
          invited_by: string
          status?: string
        }
        Update: {
          created_at?: string
          group_id?: number
          id?: number
          invite_token?: string
          invited_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string | null
          created_at: string
          group_id: number
          id: number
          is_private: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          group_id: number
          id?: number
          is_private?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          group_id?: number
          id?: number
          is_private?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      team_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          invite_code: string
          team_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          invite_code: string
          team_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          invite_code?: string
          team_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          role: string
          status: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          role: string
          status?: string
          team_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          status?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transcriptions: {
        Row: {
          audio_url: string | null
          content: string | null
          created_at: string
          duration: number | null
          id: string
          meeting_url: string | null
          source_type: string
          summary: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          content?: string | null
          created_at?: string
          duration?: number | null
          id?: string
          meeting_url?: string | null
          source_type?: string
          summary?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          content?: string | null
          created_at?: string
          duration?: number | null
          id?: string
          meeting_url?: string | null
          source_type?: string
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      group_members_with_profiles: {
        Row: {
          avatar_url: string | null
          email: string | null
          first_name: string | null
          group_id: number | null
          id: number | null
          is_admin: boolean | null
          joined_at: string | null
          last_name: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      notes_with_profiles: {
        Row: {
          content: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          group_id: number | null
          id: number | null
          is_private: boolean | null
          last_name: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      user_groups_with_stats: {
        Row: {
          created_at: string | null
          creator_id: string | null
          id: number | null
          is_admin: boolean | null
          member_count: number | null
          name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_groups: {
        Args: { _user_id: string }
        Returns: {
          group_id: number
        }[]
      }
      get_user_groups_optimized: {
        Args: { _user_id: string }
        Returns: {
          group_id: number
          group_name: string
          creator_id: string
          created_at: string
          member_count: number
          is_admin: boolean
        }[]
      }
      is_group_admin: {
        Args: { _user_id: string; _group_id: number }
        Returns: boolean
      }
      is_group_member: {
        Args: { _user_id: string; _group_id: number }
        Returns: boolean
      }
      join_group_via_invitation: {
        Args: { _invite_token: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
