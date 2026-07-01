"use client";

import { supabase } from "../supabase";
import type { Profile } from "../crm";

export const obtenerPerfilActual =
  async (): Promise<{
    profile: Profile | null;
    error: string | null;
  }> => {
    if (!supabase) {
      return {
        profile: null,
        error:
          "Supabase no esta configurado en este entorno.",
      };
    }

    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      return {
        profile: null,
        error: "No hay sesion activa.",
      };
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id,full_name,email,role,phone,active"
      )
      .eq("id", userData.user.id)
      .maybeSingle();

    if (error) {
      return {
        profile: null,
        error: error.message,
      };
    }

    if (!data || data.active === false) {
      return {
        profile: null,
        error:
          "Tu usuario no tiene un perfil activo.",
      };
    }

    return {
      profile: data as Profile,
      error: null,
    };
  };

