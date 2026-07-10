import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type LeadPayload = {
  nombreCompleto?: string;
  celular?: string;
  correo?: string;
  loteId?: number;
  mensaje?: string;
  aceptaDatos?: boolean;
  aceptaComercial?: boolean;
  website?: string;
};

const normalizarCelular = (valor: string) => {
  let celular = valor.replace(/\D/g, "");

  if (celular.length === 11 && celular.startsWith("51")) {
    celular = celular.slice(2);
  }

  return celular;
};

const correoValido = (correo: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);

export async function POST(request: Request) {
  const contentLength = Number(
    request.headers.get("content-length") || 0
  );

  if (contentLength > 12_000) {
    return Response.json(
      { error: "La solicitud excede el tamano permitido." },
      { status: 413 }
    );
  }

  let payload: LeadPayload;

  try {
    payload = (await request.json()) as LeadPayload;
  } catch {
    return Response.json(
      { error: "La solicitud no tiene un formato valido." },
      { status: 400 }
    );
  }

  // Campo trampa para automatizaciones simples. Se responde como exito para
  // no ensenar al emisor que su solicitud fue descartada.
  if (payload.website) {
    return Response.json({ ok: true }, { status: 202 });
  }

  const nombreCompleto = (payload.nombreCompleto || "").trim();
  const celular = normalizarCelular(payload.celular || "");
  const correo = (payload.correo || "").trim().toLowerCase();
  const mensaje = (payload.mensaje || "").trim().slice(0, 1500);
  const loteId = Number(payload.loteId);

  if (nombreCompleto.length < 3 || nombreCompleto.length > 120) {
    return Response.json(
      { error: "Ingresa tu nombre completo." },
      { status: 400 }
    );
  }

  if (!/^9\d{8}$/.test(celular)) {
    return Response.json(
      { error: "Ingresa un celular peruano valido de 9 digitos." },
      { status: 400 }
    );
  }

  if (correo && (correo.length > 160 || !correoValido(correo))) {
    return Response.json(
      { error: "Ingresa un correo valido." },
      { status: 400 }
    );
  }

  if (!Number.isSafeInteger(loteId) || loteId <= 0) {
    return Response.json(
      { error: "No se pudo identificar el lote consultado." },
      { status: 400 }
    );
  }

  if (!payload.aceptaDatos) {
    return Response.json(
      { error: "Debes aceptar el tratamiento de datos personales." },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Falta configurar Supabase para la captura de leads.");

    return Response.json(
      { error: "No pudimos registrar tu solicitud en este momento." },
      { status: 503 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.rpc(
    "crm_registrar_lead_publico",
    {
      p_nombre_completo: nombreCompleto,
      p_celular: celular,
      p_correo: correo || null,
      p_lote_id: loteId,
      p_mensaje: mensaje || null,
      p_acepta_datos: true,
      p_acepta_comercial: Boolean(payload.aceptaComercial),
      p_origen: "COTIZADOR_WEB",
    }
  );

  if (error) {
    console.error("No se pudo registrar el lead publico:", {
      code: error.code,
      message: error.message,
    });

    const esValidacion = error.code === "P0001";

    return Response.json(
      {
        error: esValidacion
          ? error.message
          : "No pudimos registrar tu solicitud en este momento.",
      },
      { status: esValidacion ? 400 : 500 }
    );
  }

  return Response.json({
    ok: true,
    deduplicado: Boolean(data?.deduplicado),
  });
}
