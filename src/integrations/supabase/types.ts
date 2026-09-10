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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          sort: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          sort?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort?: number
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          pin: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          pin: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          pin?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      modifiers: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "modifiers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          modifiers: Json
          name: string
          order_id: string
          price: number
          product_id: string | null
          qty: number
          total: number
        }
        Insert: {
          id?: string
          modifiers?: Json
          name: string
          order_id: string
          price?: number
          product_id?: string | null
          qty?: number
          total?: number
        }
        Update: {
          id?: string
          modifiers?: Json
          name?: string
          order_id?: string
          price?: number
          product_id?: string | null
          qty?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          card_amount: number
          cash_amount: number
          cash_received: number
          change_given: number
          created_at: string
          created_by: string | null
          discount: number
          employee_id: string | null
          id: string
          note: string | null
          order_no: number
          payment_method: string
          shift_id: string | null
          status: string
          subtotal: number
          total: number
        }
        Insert: {
          card_amount?: number
          cash_amount?: number
          cash_received?: number
          change_given?: number
          created_at?: string
          created_by?: string | null
          discount?: number
          employee_id?: string | null
          id?: string
          note?: string | null
          order_no?: never
          payment_method?: string
          shift_id?: string | null
          status?: string
          subtotal?: number
          total?: number
        }
        Update: {
          card_amount?: number
          cash_amount?: number
          cash_received?: number
          change_given?: number
          created_at?: string
          created_by?: string | null
          discount?: number
          employee_id?: string | null
          id?: string
          note?: string | null
          order_no?: never
          payment_method?: string
          shift_id?: string | null
          status?: string
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          cost: number
          created_at: string
          emoji: string | null
          id: string
          image_url: string | null
          in_stop_list: boolean
          is_active: boolean
          name: string
          price: number
          sort: number
          stock: number
          track_stock: boolean
          unit: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cost?: number
          created_at?: string
          emoji?: string | null
          id?: string
          image_url?: string | null
          in_stop_list?: boolean
          is_active?: boolean
          name: string
          price?: number
          sort?: number
          stock?: number
          track_stock?: boolean
          unit?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cost?: number
          created_at?: string
          emoji?: string | null
          id?: string
          image_url?: string | null
          in_stop_list?: boolean
          is_active?: boolean
          name?: string
          price?: number
          sort?: number
          stock?: number
          track_stock?: boolean
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          address: string
          id: boolean
          phone: string
          receipt_footer: string
          shop_name: string
          updated_at: string
          vat_percent: number
        }
        Insert: {
          address?: string
          id?: boolean
          phone?: string
          receipt_footer?: string
          shop_name?: string
          updated_at?: string
          vat_percent?: number
        }
        Update: {
          address?: string
          id?: boolean
          phone?: string
          receipt_footer?: string
          shop_name?: string
          updated_at?: string
          vat_percent?: number
        }
        Relationships: []
      }
      shifts: {
        Row: {
          cash_end: number | null
          cash_start: number
          closed_at: string | null
          employee_id: string | null
          id: string
          note: string | null
          opened_at: string
          opened_by: string | null
          status: string
        }
        Insert: {
          cash_end?: number | null
          cash_start?: number
          closed_at?: string | null
          employee_id?: string | null
          id?: string
          note?: string | null
          opened_at?: string
          opened_by?: string | null
          status?: string
        }
        Update: {
          cash_end?: number | null
          cash_start?: number
          closed_at?: string | null
          employee_id?: string | null
          id?: string
          note?: string | null
          opened_at?: string
          opened_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          product_id: string
          qty: number
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id: string
          qty: number
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id?: string
          qty?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "cashier"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "manager", "cashier"],
    },
  },
} as const
