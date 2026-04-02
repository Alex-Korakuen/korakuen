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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bank_accounts: {
        Row: {
          account_number_last4: string
          account_type: string
          bank_name: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          is_detraccion_account: boolean
          label: string
          partner_id: string
          updated_at: string
        }
        Insert: {
          account_number_last4: string
          account_type: string
          bank_name: string
          created_at?: string
          currency: string
          id?: string
          is_active?: boolean
          is_detraccion_account?: boolean
          label: string
          partner_id: string
          updated_at?: string
        }
        Update: {
          account_number_last4?: string
          account_type?: string
          bank_name?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          is_detraccion_account?: boolean
          label?: string
          partner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_bank_accounts_partner_entity"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          cost_type: string
          created_at: string
          is_active: boolean
          label: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          cost_type: string
          created_at?: string
          is_active?: boolean
          label: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cost_type?: string
          created_at?: string
          is_active?: boolean
          label?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      entities: {
        Row: {
          city: string | null
          created_at: string
          document_number: string
          document_type: string
          entity_type: string
          id: string
          is_active: boolean
          legal_name: string
          notes: string | null
          region: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          document_number: string
          document_type: string
          entity_type: string
          id?: string
          is_active?: boolean
          legal_name: string
          notes?: string | null
          region?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          document_number?: string
          document_type?: string
          entity_type?: string
          id?: string
          is_active?: boolean
          legal_name?: string
          notes?: string | null
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      entity_contacts: {
        Row: {
          created_at: string
          email: string | null
          entity_id: string
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          entity_id: string
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          entity_id?: string
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_entity_contacts_entities"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_tags: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          tag_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_entity_tags_entities"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_entity_tags_tags"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          buy_rate: number
          created_at: string
          id: string
          mid_rate: number
          rate_date: string
          sell_rate: number
          source: string
          updated_at: string
        }
        Insert: {
          buy_rate: number
          created_at?: string
          id?: string
          mid_rate: number
          rate_date: string
          sell_rate: number
          source?: string
          updated_at?: string
        }
        Update: {
          buy_rate?: number
          created_at?: string
          id?: string
          mid_rate?: number
          rate_date?: string
          sell_rate?: number
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          invoice_id: string
          quantity: number | null
          subtotal: number
          title: string
          unit_of_measure: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          invoice_id: string
          quantity?: number | null
          subtotal: number
          title: string
          unit_of_measure?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          invoice_id?: string
          quantity?: number | null
          subtotal?: number
          title?: string
          unit_of_measure?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoice_items_categories"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "fk_invoice_items_invoices"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_items_invoices"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_balances"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "fk_invoice_items_invoices"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_totals"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "fk_invoice_items_invoices"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_retencion_dashboard"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      invoices: {
        Row: {
          comprobante_type: string | null
          cost_type: string | null
          created_at: string
          currency: string
          detraccion_rate: number | null
          direction: string
          document_ref: string | null
          due_date: string | null
          entity_id: string | null
          exchange_rate: number
          id: string
          igv_rate: number
          invoice_date: string
          invoice_number: string | null
          is_active: boolean
          is_auto_generated: boolean
          notes: string | null
          partner_id: string
          project_id: string | null
          purchase_order_id: string | null
          quote_id: string | null
          retencion_applicable: boolean | null
          retencion_rate: number | null
          retencion_verified: boolean | null
          title: string | null
          updated_at: string
        }
        Insert: {
          comprobante_type?: string | null
          cost_type?: string | null
          created_at?: string
          currency: string
          detraccion_rate?: number | null
          direction: string
          document_ref?: string | null
          due_date?: string | null
          entity_id?: string | null
          exchange_rate: number
          id?: string
          igv_rate?: number
          invoice_date: string
          invoice_number?: string | null
          is_active?: boolean
          is_auto_generated?: boolean
          notes?: string | null
          partner_id: string
          project_id?: string | null
          purchase_order_id?: string | null
          quote_id?: string | null
          retencion_applicable?: boolean | null
          retencion_rate?: number | null
          retencion_verified?: boolean | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          comprobante_type?: string | null
          cost_type?: string | null
          created_at?: string
          currency?: string
          detraccion_rate?: number | null
          direction?: string
          document_ref?: string | null
          due_date?: string | null
          entity_id?: string | null
          exchange_rate?: number
          id?: string
          igv_rate?: number
          invoice_date?: string
          invoice_number?: string | null
          is_active?: boolean
          is_auto_generated?: boolean
          notes?: string | null
          partner_id?: string
          project_id?: string | null
          purchase_order_id?: string | null
          quote_id?: string | null
          retencion_applicable?: boolean | null
          retencion_rate?: number | null
          retencion_verified?: boolean | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoices_entities"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_partner_entity"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_projects"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_quotes"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_schedule: {
        Row: {
          created_at: string
          exchange_rate: number
          id: string
          loan_id: string
          scheduled_amount: number
          scheduled_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exchange_rate?: number
          id?: string
          loan_id: string
          scheduled_amount: number
          scheduled_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exchange_rate?: number
          id?: string
          loan_id?: string
          scheduled_amount?: number
          scheduled_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_loan_schedule_loans"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_loan_schedule_loans"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "v_loan_balances"
            referencedColumns: ["loan_id"]
          },
        ]
      }
      loans: {
        Row: {
          agreed_return_amount: number | null
          agreed_return_rate: number | null
          amount: number
          created_at: string
          currency: string
          date_borrowed: string
          due_date: string | null
          entity_id: string | null
          exchange_rate: number
          id: string
          lender_contact: string | null
          lender_name: string
          notes: string | null
          partner_id: string
          project_id: string | null
          purpose: string
          return_type: string
          updated_at: string
        }
        Insert: {
          agreed_return_amount?: number | null
          agreed_return_rate?: number | null
          amount: number
          created_at?: string
          currency: string
          date_borrowed: string
          due_date?: string | null
          entity_id?: string | null
          exchange_rate?: number
          id?: string
          lender_contact?: string | null
          lender_name: string
          notes?: string | null
          partner_id: string
          project_id?: string | null
          purpose: string
          return_type: string
          updated_at?: string
        }
        Update: {
          agreed_return_amount?: number | null
          agreed_return_rate?: number | null
          amount?: number
          created_at?: string
          currency?: string
          date_borrowed?: string
          due_date?: string | null
          entity_id?: string | null
          exchange_rate?: number
          id?: string
          lender_contact?: string | null
          lender_name?: string
          notes?: string | null
          partner_id?: string
          project_id?: string | null
          purpose?: string
          return_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_loans_entities"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_loans_partner_entity"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_loans_projects"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          currency: string
          direction: string
          document_ref: string | null
          exchange_rate: number
          id: string
          is_active: boolean
          notes: string | null
          operation_number: string | null
          partner_id: string
          payment_date: string
          payment_type: string
          related_id: string
          related_to: string
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          currency: string
          direction: string
          document_ref?: string | null
          exchange_rate?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          operation_number?: string | null
          partner_id: string
          payment_date: string
          payment_type: string
          related_id: string
          related_to: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          currency?: string
          direction?: string
          document_ref?: string | null
          exchange_rate?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          operation_number?: string | null
          partner_id?: string
          payment_date?: string
          payment_type?: string
          related_id?: string
          related_to?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_payments_bank_accounts"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_payments_bank_accounts"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "v_bank_balances"
            referencedColumns: ["bank_account_id"]
          },
          {
            foreignKeyName: "fk_payments_partner_entity"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      project_budgets: {
        Row: {
          budgeted_amount: number
          category: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          notes: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          budgeted_amount: number
          category: string
          created_at?: string
          currency: string
          id?: string
          is_active?: boolean
          notes?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          budgeted_amount?: number
          category?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_budgets_category"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "fk_project_budgets_projects"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_partners: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          partner_id: string
          profit_share_pct: number
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          partner_id: string
          profit_share_pct: number
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          partner_id?: string
          profit_share_pct?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_partners_partner_entity"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_partners_projects"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_end_date: string | null
          client_entity_id: string | null
          contract_currency: string | null
          contract_value: number | null
          created_at: string
          expected_end_date: string | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          notes: string | null
          project_code: string
          project_type: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          client_entity_id?: string | null
          contract_currency?: string | null
          contract_value?: number | null
          created_at?: string
          expected_end_date?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          notes?: string | null
          project_code: string
          project_type: string
          start_date?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          client_entity_id?: string | null
          contract_currency?: string | null
          contract_value?: number | null
          created_at?: string
          expected_end_date?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          notes?: string | null
          project_code?: string
          project_type?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_projects_entities"
            columns: ["client_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          currency: string
          date_received: string
          document_ref: string | null
          entity_id: string
          exchange_rate: number
          id: string
          igv_amount: number | null
          linked_invoice_id: string | null
          notes: string | null
          project_id: string
          quantity: number | null
          status: string
          subtotal: number
          title: string
          total: number
          unit_of_measure: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency: string
          date_received: string
          document_ref?: string | null
          entity_id: string
          exchange_rate?: number
          id?: string
          igv_amount?: number | null
          linked_invoice_id?: string | null
          notes?: string | null
          project_id: string
          quantity?: number | null
          status: string
          subtotal: number
          title: string
          total: number
          unit_of_measure?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          date_received?: string
          document_ref?: string | null
          entity_id?: string
          exchange_rate?: number
          id?: string
          igv_amount?: number | null
          linked_invoice_id?: string | null
          notes?: string | null
          project_id?: string
          quantity?: number | null
          status?: string
          subtotal?: number
          title?: string
          total?: number
          unit_of_measure?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_quotes_entities"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_quotes_projects"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_bank_balances: {
        Row: {
          account_number_last4: string | null
          account_type: string | null
          balance: number | null
          bank_account_id: string | null
          bank_name: string | null
          currency: string | null
          is_active: boolean | null
          is_detraccion_account: boolean | null
          partner_id: string | null
          partner_name: string | null
          transaction_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_bank_accounts_partner_entity"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      v_budget_vs_actual: {
        Row: {
          actual_amount: number | null
          budgeted_amount: number | null
          budgeted_currency: string | null
          category: string | null
          notes: string | null
          pct_used: number | null
          project_code: string | null
          project_id: string | null
          project_name: string | null
          variance: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_budgets_category"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "fk_project_budgets_projects"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v_igv_position: {
        Row: {
          currency: string | null
          igv_collected: number | null
          igv_paid: number | null
          net_igv_position: number | null
        }
        Relationships: []
      }
      v_invoice_balances: {
        Row: {
          amount_paid: number | null
          bdn_outstanding: number | null
          bdn_outstanding_pen: number | null
          comprobante_type: string | null
          cost_type: string | null
          currency: string | null
          detraccion_amount: number | null
          detraccion_paid: number | null
          detraccion_rate: number | null
          direction: string | null
          document_ref: string | null
          due_date: string | null
          entity_id: string | null
          exchange_rate: number | null
          igv_amount: number | null
          igv_rate: number | null
          invoice_date: string | null
          invoice_id: string | null
          invoice_number: string | null
          net_amount: number | null
          notes: string | null
          outstanding: number | null
          partner_id: string | null
          payable_or_receivable: number | null
          payment_status: string | null
          project_id: string | null
          retencion_amount: number | null
          retencion_applicable: boolean | null
          retencion_outstanding: number | null
          retencion_paid: number | null
          retencion_rate: number | null
          retencion_verified: boolean | null
          subtotal: number | null
          title: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoices_entities"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_partner_entity"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_projects"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v_invoice_totals: {
        Row: {
          comprobante_type: string | null
          cost_type: string | null
          currency: string | null
          detraccion_amount: number | null
          detraccion_rate: number | null
          direction: string | null
          document_ref: string | null
          due_date: string | null
          entity_id: string | null
          exchange_rate: number | null
          igv_amount: number | null
          igv_rate: number | null
          invoice_date: string | null
          invoice_id: string | null
          invoice_number: string | null
          notes: string | null
          partner_id: string | null
          project_id: string | null
          purchase_order_id: string | null
          quote_id: string | null
          retencion_amount: number | null
          retencion_applicable: boolean | null
          retencion_rate: number | null
          retencion_verified: boolean | null
          subtotal: number | null
          title: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoices_entities"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_partner_entity"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_projects"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_quotes"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      v_invoices_with_loans: {
        Row: {
          aging_bucket: string | null
          amount_paid: number | null
          bdn_outstanding: number | null
          bdn_outstanding_pen: number | null
          comprobante_type: string | null
          cost_type: string | null
          currency: string | null
          days_overdue: number | null
          detraccion_amount: number | null
          direction: string | null
          document_ref: string | null
          due_date: string | null
          entity_id: string | null
          entity_name: string | null
          exchange_rate: number | null
          id: string | null
          igv_amount: number | null
          invoice_date: string | null
          invoice_number: string | null
          loan_id: string | null
          outstanding: number | null
          partner_id: string | null
          payment_status: string | null
          project_code: string | null
          project_id: string | null
          project_name: string | null
          retencion_amount: number | null
          subtotal: number | null
          title: string | null
          total: number | null
          type: string | null
        }
        Relationships: []
      }
      v_loan_balances: {
        Row: {
          currency: string | null
          date_borrowed: string | null
          due_date: string | null
          exchange_rate: number | null
          lender_contact: string | null
          lender_name: string | null
          loan_id: string | null
          outstanding: number | null
          paid_schedule_count: number | null
          partner_id: string | null
          principal: number | null
          project_id: string | null
          purpose: string | null
          scheduled_payments_count: number | null
          status: string | null
          total_owed: number | null
          total_paid: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_loans_partner_entity"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_loans_projects"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v_obligation_calendar: {
        Row: {
          amount_paid: number | null
          bdn_outstanding: number | null
          bdn_outstanding_pen: number | null
          cost_type: string | null
          currency: string | null
          date: string | null
          days_remaining: number | null
          detraccion_amount: number | null
          direction: string | null
          document_ref: string | null
          due_date: string | null
          entity_id: string | null
          entity_name: string | null
          exchange_rate: number | null
          igv_amount: number | null
          invoice_id: string | null
          invoice_number: string | null
          loan_id: string | null
          outstanding: number | null
          partner_id: string | null
          payable: number | null
          payment_status: string | null
          project_code: string | null
          project_id: string | null
          project_name: string | null
          subtotal: number | null
          title: string | null
          total: number | null
          type: string | null
        }
        Relationships: []
      }
      v_payments_enriched: {
        Row: {
          amount: number | null
          bank_account_id: string | null
          bank_name: string | null
          currency: string | null
          direction: string | null
          document_ref: string | null
          entity_name: string | null
          exchange_rate: number | null
          id: string | null
          invoice_number: string | null
          notes: string | null
          operation_number: string | null
          partner_id: string | null
          partner_name: string | null
          payment_date: string | null
          payment_type: string | null
          project_code: string | null
          project_id: string | null
          related_id: string | null
          related_to: string | null
          title: string | null
        }
        Relationships: []
      }
      v_retencion_dashboard: {
        Row: {
          client_name: string | null
          currency: string | null
          days_since_invoice: number | null
          due_date: string | null
          gross_total: number | null
          invoice_date: string | null
          invoice_id: string | null
          invoice_number: string | null
          project_code: string | null
          retencion_amount: number | null
          retencion_verified: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      fn_create_invoice_with_items: {
        Args: { header_data: Json; items_data: Json }
        Returns: Json
      }
      fn_detraccion_amount: {
        Args: { detraccion_rate: number; igv_amount: number; subtotal: number }
        Returns: number
      }
      fn_igv_amount: {
        Args: { igv_rate: number; subtotal: number }
        Returns: number
      }
      fn_retencion_amount: {
        Args: { igv_amount: number; retencion_rate: number; subtotal: number }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
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
