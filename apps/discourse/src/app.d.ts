/// <reference types="@sveltejs/kit" />

declare global {
  namespace App {
    interface Locals {
      user: import('@supabase/supabase-js').User | null;
      session: import('@supabase/supabase-js').Session | null;
    }
    interface PageData {
      session: import('@supabase/supabase-js').Session | null;
    }
    interface Error {
      message: string;
      code?: string;
    }
    interface Platform {}
  }
}

export {}; 