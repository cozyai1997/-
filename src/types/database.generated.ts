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
      app_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          reason_ko: string
          role: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          reason_ko: string
          role: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          reason_ko?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          entity_id: string
          entity_type: string
          id: number
          occurred_at: string
          reason_ko: string | null
          user_id: string
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          entity_id: string
          entity_type: string
          id?: never
          occurred_at?: string
          reason_ko?: string | null
          user_id: string
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          entity_id?: string
          entity_type?: string
          id?: never
          occurred_at?: string
          reason_ko?: string | null
          user_id?: string
        }
        Relationships: []
      }
      data_publications: {
        Row: {
          activated_at: string | null
          created_at: string
          id: string
          retired_at: string | null
          row_counts: Json
          sha256: Json
          source_manifest: Json
          status: Database["public"]["Enums"]["publication_status"]
          validated_at: string | null
          validation_report: Json
          version: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          id?: string
          retired_at?: string | null
          row_counts?: Json
          sha256?: Json
          source_manifest?: Json
          status?: Database["public"]["Enums"]["publication_status"]
          validated_at?: string | null
          validation_report?: Json
          version: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          id?: string
          retired_at?: string | null
          row_counts?: Json
          sha256?: Json
          source_manifest?: Json
          status?: Database["public"]["Enums"]["publication_status"]
          validated_at?: string | null
          validation_report?: Json
          version?: string
        }
        Relationships: []
      }
      owned_pokemon: {
        Row: {
          ability_id: string | null
          captured_on: string | null
          created_at: string
          effective_iv: Json
          effective_nature_id: string | null
          ev: Json
          form_id: string
          gender: Database["public"]["Enums"]["pokemon_gender"]
          held_item_id: string | null
          id: string
          level: number
          nickname: string | null
          notes: string
          original_iv: Json
          original_nature_id: string | null
          species_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ability_id?: string | null
          captured_on?: string | null
          created_at?: string
          effective_iv?: Json
          effective_nature_id?: string | null
          ev?: Json
          form_id: string
          gender: Database["public"]["Enums"]["pokemon_gender"]
          held_item_id?: string | null
          id?: string
          level: number
          nickname?: string | null
          notes?: string
          original_iv?: Json
          original_nature_id?: string | null
          species_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ability_id?: string | null
          captured_on?: string | null
          created_at?: string
          effective_iv?: Json
          effective_nature_id?: string | null
          ev?: Json
          form_id?: string
          gender?: Database["public"]["Enums"]["pokemon_gender"]
          held_item_id?: string | null
          id?: string
          level?: number
          nickname?: string | null
          notes?: string
          original_iv?: Json
          original_nature_id?: string | null
          species_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owned_form_matches_species"
            columns: ["form_id", "species_id"]
            isOneToOne: false
            referencedRelation: "reference_forms"
            referencedColumns: ["id", "species_id"]
          },
          {
            foreignKeyName: "owned_pokemon_ability_id_fkey"
            columns: ["ability_id"]
            isOneToOne: false
            referencedRelation: "reference_abilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owned_pokemon_effective_nature_id_fkey"
            columns: ["effective_nature_id"]
            isOneToOne: false
            referencedRelation: "reference_natures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owned_pokemon_held_item_id_fkey"
            columns: ["held_item_id"]
            isOneToOne: false
            referencedRelation: "reference_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owned_pokemon_original_nature_id_fkey"
            columns: ["original_nature_id"]
            isOneToOne: false
            referencedRelation: "reference_natures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owned_pokemon_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "reference_species"
            referencedColumns: ["id"]
          },
        ]
      }
      owned_pokemon_images: {
        Row: {
          byte_size: number
          created_at: string
          height: number | null
          id: string
          mime_type: string
          owned_pokemon_id: string
          storage_path: string
          width: number | null
        }
        Insert: {
          byte_size: number
          created_at?: string
          height?: number | null
          id?: string
          mime_type: string
          owned_pokemon_id: string
          storage_path: string
          width?: number | null
        }
        Update: {
          byte_size?: number
          created_at?: string
          height?: number | null
          id?: string
          mime_type?: string
          owned_pokemon_id?: string
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "owned_pokemon_images_owned_pokemon_id_fkey"
            columns: ["owned_pokemon_id"]
            isOneToOne: false
            referencedRelation: "owned_pokemon"
            referencedColumns: ["id"]
          },
        ]
      }
      owned_pokemon_moves: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["owned_move_kind"]
          move_id: string
          owned_pokemon_id: string
          slot: number
          target_condition_ko: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["owned_move_kind"]
          move_id: string
          owned_pokemon_id: string
          slot: number
          target_condition_ko?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["owned_move_kind"]
          move_id?: string
          owned_pokemon_id?: string
          slot?: number
          target_condition_ko?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owned_pokemon_moves_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "reference_moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owned_pokemon_moves_owned_pokemon_id_fkey"
            columns: ["owned_pokemon_id"]
            isOneToOne: false
            referencedRelation: "owned_pokemon"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_abilities: {
        Row: {
          description_ko: string
          id: string
          identifier: string
          is_active: boolean
          name_ko: string
          publication_id: string | null
        }
        Insert: {
          description_ko: string
          id?: string
          identifier: string
          is_active?: boolean
          name_ko: string
          publication_id?: string | null
        }
        Update: {
          description_ko?: string
          id?: string
          identifier?: string
          is_active?: boolean
          name_ko?: string
          publication_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_abilities_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "data_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_evolution_rules: {
        Row: {
          condition_ko: string
          from_form_id: string
          id: string
          publication_id: string | null
          sort_order: number
          to_form_id: string
        }
        Insert: {
          condition_ko: string
          from_form_id: string
          id?: string
          publication_id?: string | null
          sort_order?: number
          to_form_id: string
        }
        Update: {
          condition_ko?: string
          from_form_id?: string
          id?: string
          publication_id?: string | null
          sort_order?: number
          to_form_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_evolution_rules_from_form_id_fkey"
            columns: ["from_form_id"]
            isOneToOne: false
            referencedRelation: "reference_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_evolution_rules_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "data_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_evolution_rules_to_form_id_fkey"
            columns: ["to_form_id"]
            isOneToOne: false
            referencedRelation: "reference_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_form_abilities: {
        Row: {
          ability_id: string
          form_id: string
          id: string
          is_hidden: boolean
          publication_id: string
          slot: string
        }
        Insert: {
          ability_id: string
          form_id: string
          id?: string
          is_hidden?: boolean
          publication_id: string
          slot: string
        }
        Update: {
          ability_id?: string
          form_id?: string
          id?: string
          is_hidden?: boolean
          publication_id?: string
          slot?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_form_abilities_ability_id_fkey"
            columns: ["ability_id"]
            isOneToOne: false
            referencedRelation: "reference_abilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_form_abilities_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "reference_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_form_abilities_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "data_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_forms: {
        Row: {
          base_form_id: string | null
          id: string
          identifier: string
          is_active: boolean
          is_default: boolean
          name_ko: string
          primary_type_id: string | null
          publication_id: string | null
          secondary_type_id: string | null
          species_id: string
        }
        Insert: {
          base_form_id?: string | null
          id?: string
          identifier: string
          is_active?: boolean
          is_default?: boolean
          name_ko: string
          primary_type_id?: string | null
          publication_id?: string | null
          secondary_type_id?: string | null
          species_id: string
        }
        Update: {
          base_form_id?: string | null
          id?: string
          identifier?: string
          is_active?: boolean
          is_default?: boolean
          name_ko?: string
          primary_type_id?: string | null
          publication_id?: string | null
          secondary_type_id?: string | null
          species_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_forms_base_form_id_fkey"
            columns: ["base_form_id"]
            isOneToOne: false
            referencedRelation: "reference_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_forms_primary_type_id_fkey"
            columns: ["primary_type_id"]
            isOneToOne: false
            referencedRelation: "reference_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_forms_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "data_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_forms_secondary_type_id_fkey"
            columns: ["secondary_type_id"]
            isOneToOne: false
            referencedRelation: "reference_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_forms_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "reference_species"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_items: {
        Row: {
          description_ko: string
          id: string
          identifier: string
          is_active: boolean
          name_ko: string
          publication_id: string | null
        }
        Insert: {
          description_ko: string
          id?: string
          identifier: string
          is_active?: boolean
          name_ko: string
          publication_id?: string | null
        }
        Update: {
          description_ko?: string
          id?: string
          identifier?: string
          is_active?: boolean
          name_ko?: string
          publication_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_items_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "data_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_move_learnsets: {
        Row: {
          condition_ko: string
          form_id: string | null
          id: string
          learn_level: number | null
          learn_method: string
          move_id: string
          publication_id: string | null
          species_id: string
        }
        Insert: {
          condition_ko?: string
          form_id?: string | null
          id?: string
          learn_level?: number | null
          learn_method: string
          move_id: string
          publication_id?: string | null
          species_id: string
        }
        Update: {
          condition_ko?: string
          form_id?: string | null
          id?: string
          learn_level?: number | null
          learn_method?: string
          move_id?: string
          publication_id?: string | null
          species_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_move_learnsets_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "reference_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_move_learnsets_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "reference_moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_move_learnsets_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "data_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_move_learnsets_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "reference_species"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_moves: {
        Row: {
          accuracy: number | null
          damage_class: string
          description_ko: string
          id: string
          identifier: string
          is_active: boolean
          name_ko: string
          power: number | null
          pp: number | null
          priority: number
          publication_id: string | null
          type_id: string
        }
        Insert: {
          accuracy?: number | null
          damage_class: string
          description_ko: string
          id?: string
          identifier: string
          is_active?: boolean
          name_ko: string
          power?: number | null
          pp?: number | null
          priority?: number
          publication_id?: string | null
          type_id: string
        }
        Update: {
          accuracy?: number | null
          damage_class?: string
          description_ko?: string
          id?: string
          identifier?: string
          is_active?: boolean
          name_ko?: string
          power?: number | null
          pp?: number | null
          priority?: number
          publication_id?: string | null
          type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_moves_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "data_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_moves_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "reference_types"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_natures: {
        Row: {
          decreased_stat: string | null
          id: string
          identifier: string
          increased_stat: string | null
          is_active: boolean
          name_ko: string
          publication_id: string | null
        }
        Insert: {
          decreased_stat?: string | null
          id?: string
          identifier: string
          increased_stat?: string | null
          is_active?: boolean
          name_ko: string
          publication_id?: string | null
        }
        Update: {
          decreased_stat?: string | null
          id?: string
          identifier?: string
          increased_stat?: string | null
          is_active?: boolean
          name_ko?: string
          publication_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_natures_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "data_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_option_filter_publication_staging: {
        Row: {
          batch_id: string
          id: string
          payload: Json
          publication_id: string
          row_kind: string
          source_order: number
        }
        Insert: {
          batch_id: string
          id?: string
          payload: Json
          publication_id: string
          row_kind: string
          source_order: number
        }
        Update: {
          batch_id?: string
          id?: string
          payload?: Json
          publication_id?: string
          row_kind?: string
          source_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "reference_option_filter_publication_staging_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "data_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_species: {
        Row: {
          description_ko: string
          id: string
          identifier: string
          is_active: boolean
          name_ko: string
          national_dex_number: number
          primary_type_id: string | null
          publication_id: string | null
          secondary_type_id: string | null
        }
        Insert: {
          description_ko: string
          id?: string
          identifier: string
          is_active?: boolean
          name_ko: string
          national_dex_number: number
          primary_type_id?: string | null
          publication_id?: string | null
          secondary_type_id?: string | null
        }
        Update: {
          description_ko?: string
          id?: string
          identifier?: string
          is_active?: boolean
          name_ko?: string
          national_dex_number?: number
          primary_type_id?: string | null
          publication_id?: string | null
          secondary_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_species_primary_type_id_fkey"
            columns: ["primary_type_id"]
            isOneToOne: false
            referencedRelation: "reference_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_species_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "data_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_species_secondary_type_id_fkey"
            columns: ["secondary_type_id"]
            isOneToOne: false
            referencedRelation: "reference_types"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_type_matchups: {
        Row: {
          attacking_type_id: string
          defending_type_id: string
          multiplier: number
          publication_id: string | null
        }
        Insert: {
          attacking_type_id: string
          defending_type_id: string
          multiplier: number
          publication_id?: string | null
        }
        Update: {
          attacking_type_id?: string
          defending_type_id?: string
          multiplier?: number
          publication_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_type_matchups_attacking_type_id_fkey"
            columns: ["attacking_type_id"]
            isOneToOne: false
            referencedRelation: "reference_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_type_matchups_defending_type_id_fkey"
            columns: ["defending_type_id"]
            isOneToOne: false
            referencedRelation: "reference_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_type_matchups_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "data_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_types: {
        Row: {
          color_hex: string
          id: string
          identifier: string
          is_active: boolean
          name_ko: string
          publication_id: string | null
          sort_order: number
        }
        Insert: {
          color_hex: string
          id?: string
          identifier: string
          is_active?: boolean
          name_ko: string
          publication_id?: string | null
          sort_order: number
        }
        Update: {
          color_hex?: string
          id?: string
          identifier?: string
          is_active?: boolean
          name_ko?: string
          publication_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "reference_types_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "data_publications"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      correct_owned_pokemon: {
        Args: {
          p_captured_on: string
          p_form_id: string
          p_original_iv: Json
          p_owned_pokemon_id: string
          p_reason_ko: string
          p_species_id: string
        }
        Returns: {
          ability_id: string | null
          captured_on: string | null
          created_at: string
          effective_iv: Json
          effective_nature_id: string | null
          ev: Json
          form_id: string
          gender: Database["public"]["Enums"]["pokemon_gender"]
          held_item_id: string | null
          id: string
          level: number
          nickname: string | null
          notes: string
          original_iv: Json
          original_nature_id: string | null
          species_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "owned_pokemon"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_owned_pokemon_with_moves: {
        Args: {
          p_ability_id: string
          p_captured_on: string
          p_current_moves: Json
          p_effective_iv: Json
          p_effective_nature_id: string
          p_ev: Json
          p_form_id: string
          p_gender: Database["public"]["Enums"]["pokemon_gender"]
          p_held_item_id: string
          p_level: number
          p_nickname: string
          p_notes: string
          p_original_iv: Json
          p_original_nature_id: string
          p_species_id: string
          p_target_moves: Json
        }
        Returns: string
      }
      replace_pokemon_option_filter_reference_data: {
        Args: { p_batch_id: string; p_publication_id: string }
        Returns: undefined
      }
      update_owned_pokemon_quick: {
        Args: {
          p_ability_id: string
          p_effective_iv: Json
          p_effective_nature_id: string
          p_ev: Json
          p_gender: Database["public"]["Enums"]["pokemon_gender"]
          p_held_item_id: string
          p_level: number
          p_nickname: string
          p_notes: string
          p_owned_pokemon_id: string
        }
        Returns: {
          ability_id: string | null
          captured_on: string | null
          created_at: string
          effective_iv: Json
          effective_nature_id: string | null
          ev: Json
          form_id: string
          gender: Database["public"]["Enums"]["pokemon_gender"]
          held_item_id: string | null
          id: string
          level: number
          nickname: string | null
          notes: string
          original_iv: Json
          original_nature_id: string | null
          species_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "owned_pokemon"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      stat_block_greater_than_or_equal: {
        Args: { left_block: Json; right_block: Json }
        Returns: boolean
      }
      valid_stat_block: {
        Args: { block: Json; per_stat_max: number; total_max: number }
        Returns: boolean
      }
    }
    Enums: {
      owned_move_kind: "current" | "target"
      pokemon_gender: "male" | "female" | "genderless"
      publication_status:
        | "draft"
        | "validated"
        | "active"
        | "retired"
        | "rejected"
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
    Enums: {
      owned_move_kind: ["current", "target"],
      pokemon_gender: ["male", "female", "genderless"],
      publication_status: [
        "draft",
        "validated",
        "active",
        "retired",
        "rejected",
      ],
    },
  },
} as const
