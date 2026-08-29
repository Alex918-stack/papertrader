export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      benchmark_prices: {
        Row: {
          close: number
          date: string
        }
        Insert: {
          close: number
          date: string
        }
        Update: {
          close?: number
          date?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          surface: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          surface: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          surface?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      holdings: {
        Row: {
          avg_cost: number
          id: string
          portfolio_id: string
          shares: number
          symbol: string
          updated_at: string
        }
        Insert: {
          avg_cost: number
          id?: string
          portfolio_id: string
          shares: number
          symbol: string
          updated_at?: string
        }
        Update: {
          avg_cost?: number
          id?: string
          portfolio_id?: string
          shares?: number
          symbol?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          execution_results: Json | null
          id: string
          ordinal: number
          proposed_trades: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          execution_results?: Json | null
          id?: string
          ordinal: number
          proposed_trades?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          execution_results?: Json | null
          id?: string
          ordinal?: number
          proposed_trades?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          benchmark_start_date: string
          cash: number
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          benchmark_start_date?: string
          cash?: number
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          benchmark_start_date?: string
          cash?: number
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      position_episodes: {
        Row: {
          closed_at: string | null
          critique: string | null
          critique_generated_at: string | null
          exit_reflection: string | null
          exit_reflection_note: string | null
          id: string
          opened_at: string
          portfolio_id: string
          symbol: string
          thesis_invalidation: string | null
          thesis_invalidation_price: number | null
          thesis_why_now: string | null
          thesis_why_this: string | null
        }
        Insert: {
          closed_at?: string | null
          critique?: string | null
          critique_generated_at?: string | null
          exit_reflection?: string | null
          exit_reflection_note?: string | null
          id?: string
          opened_at?: string
          portfolio_id: string
          symbol: string
          thesis_invalidation?: string | null
          thesis_invalidation_price?: number | null
          thesis_why_now?: string | null
          thesis_why_this?: string | null
        }
        Update: {
          closed_at?: string | null
          critique?: string | null
          critique_generated_at?: string | null
          exit_reflection?: string | null
          exit_reflection_note?: string | null
          id?: string
          opened_at?: string
          portfolio_id?: string
          symbol?: string
          thesis_invalidation?: string | null
          thesis_invalidation_price?: number | null
          thesis_why_now?: string | null
          thesis_why_this?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "position_episodes_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          tour_dismissed_at: string | null
          tour_step_index: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          tour_dismissed_at?: string | null
          tour_step_index?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          tour_dismissed_at?: string | null
          tour_step_index?: number | null
        }
        Relationships: []
      }
      rate_limit_cooldowns: {
        Row: {
          bucket: string
          key: string
          requested_at: string
        }
        Insert: {
          bucket: string
          key: string
          requested_at?: string
        }
        Update: {
          bucket?: string
          key?: string
          requested_at?: string
        }
        Relationships: []
      }
      symbol_daily_prices: {
        Row: {
          close: number
          date: string
          symbol: string
          volume: number | null
        }
        Insert: {
          close: number
          date: string
          symbol: string
          volume?: number | null
        }
        Update: {
          close?: number
          date?: string
          symbol?: string
          volume?: number | null
        }
        Relationships: []
      }
      symbol_daily_prices_claims: {
        Row: {
          fetching_until: string | null
          symbol: string
        }
        Insert: {
          fetching_until?: string | null
          symbol: string
        }
        Update: {
          fetching_until?: string | null
          symbol?: string
        }
        Relationships: []
      }
      symbol_profiles: {
        Row: {
          country: string | null
          exchange: string | null
          fetching_until: string | null
          industry: string | null
          ipo: string | null
          market_cap: number | null
          name: string | null
          symbol: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          country?: string | null
          exchange?: string | null
          fetching_until?: string | null
          industry?: string | null
          ipo?: string | null
          market_cap?: number | null
          name?: string | null
          symbol: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          country?: string | null
          exchange?: string | null
          fetching_until?: string | null
          industry?: string | null
          ipo?: string | null
          market_cap?: number | null
          name?: string | null
          symbol?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      symbol_quotes: {
        Row: {
          change: number | null
          change_percent: number | null
          fetching_until: string | null
          price: number | null
          symbol: string
          updated_at: string | null
        }
        Insert: {
          change?: number | null
          change_percent?: number | null
          fetching_until?: string | null
          price?: number | null
          symbol: string
          updated_at?: string | null
        }
        Update: {
          change?: number | null
          change_percent?: number | null
          fetching_until?: string | null
          price?: number | null
          symbol?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          episode_id: string | null
          executed_at: string
          id: string
          note: string | null
          portfolio_id: string
          price: number
          quoted_price: number | null
          shares: number
          slippage_cost: number | null
          spread_cost: number | null
          symbol: string
          total: number
          type: string
        }
        Insert: {
          episode_id?: string | null
          executed_at?: string
          id?: string
          note?: string | null
          portfolio_id: string
          price: number
          quoted_price?: number | null
          shares: number
          slippage_cost?: number | null
          spread_cost?: number | null
          symbol: string
          total: number
          type: string
        }
        Update: {
          episode_id?: string | null
          executed_at?: string
          id?: string
          note?: string | null
          portfolio_id?: string
          price?: number
          quoted_price?: number | null
          shares?: number
          slippage_cost?: number | null
          spread_cost?: number | null
          symbol?: string
          total?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "position_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      benchmark_trading_date: { Args: { p_ts: string }; Returns: string }
      default_starting_cash: { Args: never; Returns: number }
      execute_trade: {
        Args: {
          p_action: string
          p_note?: string
          p_price: number
          p_quoted_price?: number
          p_shares: number
          p_slippage_cost?: number
          p_spread_cost?: number
          p_symbol: string
          p_thesis_invalidation?: string
          p_thesis_invalidation_price?: number
          p_thesis_why_now?: string
          p_thesis_why_this?: string
        }
        Returns: number
      }
      import_legacy_conversations: {
        Args: { p_conversations: Json; p_surface: string }
        Returns: boolean
      }
      import_legacy_portfolio: {
        Args: { p_cash: number; p_holdings: Json; p_transactions: Json }
        Returns: boolean
      }
      record_exit_reflection: {
        Args: {
          p_episode_id: string
          p_exit_reflection: string
          p_exit_reflection_note?: string
        }
        Returns: undefined
      }
      reset_portfolio: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
