import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { after } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type MetaLeadEventRow = {
  id: string;
  meta_lead_id: string;
  page_id: string | null;
  form_id: string | null;
  ad_id: string | null;
  status: "PENDIENTE" | "PROCESANDO" | "COMPLETADO" | "ERROR";
  attempts: number;
  payload: Json;
  last_error: string | null;
  received_at: string;
  last_attempt_at: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

type MetaLeadEventInsert = {
  id?: string;
  meta_lead_id: string;
  page_id?: string | null;
  form_id?: string | null;
  ad_id?: string | null;
  status?: MetaLeadEventRow["status"];
  attempts?: number;
  payload?: Json;
  last_error?: string | null;
  received_at?: string;
  last_attempt_at?: string | null;
  processed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type MetaDatabase = {
  public: {
    Tables: {
      meta_lead_events: {
        Row: MetaLeadEventRow;
        Insert: MetaLeadEventInsert;
        Update: Partial<MetaLeadEventInsert>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          role: string;
          active: boolean;
        };
        Insert: {
          id: string;
          role: string;
          active?: boolean;
        };
        Update: {
          role?: string;
          active?: boolean;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      crm_registrar_lead_meta: {
        Args: {
          p_meta_lead_id: string;
          p_nombre_completo: string;
          p_celular: string;
          p_correo: string | null;
          p_page_id: string | null;
          p_form_id: string | null;
          p_ad_id: string | null;
          p_adset_id: string | null;
          p_campaign_id: string | null;
          p_ad_name: string | null;
          p_adset_name: string | null;
          p_campaign_name: string | null;
          p_respuestas: Json;
          p_raw_payload: Json;
          p_acepta_comercial: boolean;
          p_meta_created_at: string | null;
        };
        Returns: Json;
      };
    };
  };
};

const crearSupabaseAdmin = (url: string, serviceRoleKey: string) =>
  createClient<MetaDatabase>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

type MetaFieldData = {
  name?: string;
  values?: Array<string | number | boolean>;
};

type MetaLeadData = {
  id?: string;
  created_time?: string;
  ad_id?: string;
  form_id?: string;
  field_data?: MetaFieldData[];
};

type MetaAdData = {
  id?: string;
  name?: string;
  adset_id?: string;
  campaign_id?: string;
};

type MetaNamedObject = {
  id?: string;
  name?: string;
};

type MetaLeadEvent = {
  leadId: string;
  pageId: string | null;
  formId: string | null;
  adId: string | null;
  createdTime: number | null;
  payload: Json;
};

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: Record<string, unknown>;
    }>;
  }>;
};

type SupabaseAdmin = ReturnType<typeof crearSupabaseAdmin>;

const META_PAGE_ID_ESPERADA = "1184880321368734";
const META_FORM_ID_ESPERADO = "884453447577874";

const normalizarClave = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizarCelular = (valor: string) => {
  let celular = valor.replace(/\D/g, "");

  if (celular.length === 11 && celular.startsWith("51")) {
    celular = celular.slice(2);
  }

  return celular;
};

const obtenerCampos = (fieldData: MetaFieldData[] = []) => {
  const campos = new Map<string, string>();
  const respuestas: Record<string, string[]> = {};

  fieldData.forEach((campo) => {
    const nombreOriginal = String(campo.name || "").trim();
    const clave = normalizarClave(nombreOriginal);
    const valores = (campo.values || []).map((valor) => String(valor));

    if (!clave) return;

    campos.set(clave, valores.join(" ").trim());
    respuestas[nombreOriginal || clave] = valores;
  });

  return { campos, respuestas };
};

const buscarCampo = (
  campos: Map<string, string>,
  candidatos: string[]
) => {
  for (const candidato of candidatos) {
    const valor = campos.get(normalizarClave(candidato));

    if (valor) return valor;
  }

  return "";
};

const aceptaContactoWhatsApp = (campos: Map<string, string>) => {
  const configuradas = (
    process.env.META_WHATSAPP_CONSENT_FIELD ||
    "consentimiento_whatsapp,acepto_contacto_por_whatsapp,autoriza_whatsapp"
  )
    .split(",")
    .map(normalizarClave)
    .filter(Boolean);

  const claves = [...campos.keys()].filter(
    (clave) =>
      configuradas.includes(clave) ||
      (clave.includes("whatsapp") &&
        (clave.includes("acept") ||
          clave.includes("autoriz") ||
          clave.includes("consent")))
  );

  return claves.some((clave) => {
    const respuesta = normalizarClave(campos.get(clave) || "");

    return [
      "si",
      "yes",
      "acepto",
      "autorizo",
      "de_acuerdo",
      "confirmo",
    ].some((valor) => respuesta.includes(valor));
  });
};

const versionGraph = () => {
  const version = process.env.META_GRAPH_API_VERSION || "v25.0";

  return /^v\d+\.\d+$/.test(version) ? version : "v25.0";
};

const graphGet = async <T>(
  objectId: string,
  fields: string,
  accessToken: string
): Promise<T> => {
  const url = new URL(
    `https://graph.facebook.com/${versionGraph()}/${encodeURIComponent(
      objectId
    )}`
  );
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number };
  } & T;

  if (!response.ok || data.error) {
    throw new Error(
      `Meta Graph API rechazo la consulta (${data.error?.code || response.status}): ${
        data.error?.message || "respuesta no disponible"
      }`
    );
  }

  return data;
};

const extraerEventos = (payload: MetaWebhookPayload): MetaLeadEvent[] => {
  if (payload.object !== "page") return [];

  const eventos: MetaLeadEvent[] = [];

  (payload.entry || []).forEach((entry) => {
    (entry.changes || []).forEach((change) => {
      if (change.field !== "leadgen" || !change.value) return;

      const leadId = String(change.value.leadgen_id || "").trim();

      if (!leadId) return;

      eventos.push({
        leadId,
        pageId: String(change.value.page_id || entry.id || "").trim() || null,
        formId: String(change.value.form_id || "").trim() || null,
        adId: String(change.value.ad_id || "").trim() || null,
        createdTime: Number.isFinite(Number(change.value.created_time))
          ? Number(change.value.created_time)
          : null,
        payload: change.value as Json,
      });
    });
  });

  return eventos;
};

const verificarFirma = (
  rawBody: string,
  signature: string | null,
  appSecret: string
) => {
  if (!signature?.startsWith("sha256=")) return false;

  const expected = `sha256=${createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex")}`;
  const receivedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
};

const guardarEvento = async (
  supabase: SupabaseAdmin,
  evento: MetaLeadEvent
) => {
  const { data: existente, error: consultaError } = await supabase
    .from("meta_lead_events")
    .select("status,attempts")
    .eq("meta_lead_id", evento.leadId)
    .maybeSingle();

  if (consultaError) throw new Error(consultaError.message);

  if (!existente) {
    const { error } = await supabase.from("meta_lead_events").insert({
      meta_lead_id: evento.leadId,
      page_id: evento.pageId,
      form_id: evento.formId,
      ad_id: evento.adId,
      status: "PENDIENTE",
      payload: evento.payload,
    });

    if (error && error.code !== "23505") {
      throw new Error(error.message);
    }
  }

  return existente;
};

const actualizarEvento = async (
  supabase: SupabaseAdmin,
  leadId: string,
  values: Partial<MetaLeadEventInsert>
) => {
  const { error } = await supabase
    .from("meta_lead_events")
    .update(values)
    .eq("meta_lead_id", leadId);

  if (error) throw new Error(error.message);
};

const procesarEvento = async (
  supabase: SupabaseAdmin,
  evento: MetaLeadEvent,
  accessToken: string
) => {
  const existente = await guardarEvento(supabase, evento);

  if (existente?.status === "COMPLETADO") {
    return { deduplicado: true };
  }

  const attempts = Number(existente?.attempts || 0) + 1;

  await actualizarEvento(supabase, evento.leadId, {
    status: "PROCESANDO",
    attempts,
    last_attempt_at: new Date().toISOString(),
    last_error: null,
  });

  try {
    const lead = await graphGet<MetaLeadData>(
      evento.leadId,
      "id,created_time,ad_id,form_id,field_data",
      accessToken
    );
    const { campos, respuestas } = obtenerCampos(lead.field_data);
    const nombreCompleto =
      buscarCampo(campos, ["full_name", "nombre_completo", "nombre"]) ||
      [
        buscarCampo(campos, ["first_name", "nombres"]),
        buscarCampo(campos, ["last_name", "apellidos"]),
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
    const celular = normalizarCelular(
      buscarCampo(campos, [
        "phone_number",
        "phone",
        "telefono",
        "celular",
        "numero_de_telefono",
      ])
    );
    const correo = buscarCampo(campos, ["email", "correo", "correo_electronico"])
      .trim()
      .toLowerCase();
    const adId = lead.ad_id || evento.adId || null;
    let ad: MetaAdData = {};
    let adset: MetaNamedObject = {};
    let campaign: MetaNamedObject = {};

    if (adId) {
      try {
        ad = await graphGet<MetaAdData>(
          adId,
          "id,name,adset_id,campaign_id",
          accessToken
        );

        const [adsetResult, campaignResult] = await Promise.allSettled([
          ad.adset_id
            ? graphGet<MetaNamedObject>(ad.adset_id, "id,name", accessToken)
            : Promise.resolve({}),
          ad.campaign_id
            ? graphGet<MetaNamedObject>(ad.campaign_id, "id,name", accessToken)
            : Promise.resolve({}),
        ]);

        if (adsetResult.status === "fulfilled") adset = adsetResult.value;
        if (campaignResult.status === "fulfilled") campaign = campaignResult.value;
      } catch (error) {
        console.warn("Meta entrego el lead, pero no la atribucion completa:", {
          leadId: evento.leadId,
          message: error instanceof Error ? error.message : "error desconocido",
        });
      }
    }

    const metaCreatedAt = lead.created_time
      ? new Date(lead.created_time).toISOString()
      : evento.createdTime
        ? new Date(evento.createdTime * 1000).toISOString()
        : null;
    const { error: rpcError } = await supabase.rpc("crm_registrar_lead_meta", {
      p_meta_lead_id: evento.leadId,
      p_nombre_completo: nombreCompleto,
      p_celular: celular,
      p_correo: correo || null,
      p_page_id: evento.pageId,
      p_form_id: lead.form_id || evento.formId,
      p_ad_id: adId,
      p_adset_id: ad.adset_id || null,
      p_campaign_id: ad.campaign_id || null,
      p_ad_name: ad.name || null,
      p_adset_name: adset.name || null,
      p_campaign_name: campaign.name || null,
      p_respuestas: respuestas,
      p_raw_payload: lead as unknown as Json,
      p_acepta_comercial: aceptaContactoWhatsApp(campos),
      p_meta_created_at: metaCreatedAt,
    });

    if (rpcError) throw new Error(rpcError.message);

    await actualizarEvento(supabase, evento.leadId, {
      status: "COMPLETADO",
      processed_at: new Date().toISOString(),
      last_error: null,
    });

    return { deduplicado: false };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 1200) : "Error desconocido";

    await actualizarEvento(supabase, evento.leadId, {
      status: "ERROR",
      last_error: message,
    });

    throw error;
  }
};

const recuperarLeadAutenticado = async (
  request: Request,
  rawBody: string,
  supabase: SupabaseAdmin,
  metaAccessToken: string
) => {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!accessToken) {
    return Response.json({ error: "Autenticacion requerida." }, { status: 401 });
  }

  const { data: authData, error: authError } =
    await supabase.auth.getUser(accessToken);

  if (authError || !authData.user) {
    return Response.json({ error: "Sesion invalida." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role,active")
    .eq("id", authData.user.id)
    .single();

  if (
    profileError ||
    !profile?.active ||
    !["admin", "jefe_ventas"].includes(profile.role)
  ) {
    return Response.json({ error: "No tienes permiso para recuperar leads." }, { status: 403 });
  }

  let body: { action?: string; leadId?: string };

  try {
    body = JSON.parse(rawBody) as { action?: string; leadId?: string };
  } catch {
    return Response.json({ error: "Solicitud invalida." }, { status: 400 });
  }

  const leadId = String(body.leadId || "").trim();

  if (body.action !== "RECUPERAR_LEAD" || !/^\d{8,30}$/.test(leadId)) {
    return Response.json({ error: "Meta Lead ID invalido." }, { status: 400 });
  }

  const resultado = await procesarEvento(
    supabase,
    {
      leadId,
      pageId: META_PAGE_ID_ESPERADA,
      formId: META_FORM_ID_ESPERADO,
      adId: null,
      createdTime: null,
      payload: {
        recuperacion_manual: true,
        solicitado_por: authData.user.id,
      },
    },
    metaAccessToken
  );

  return Response.json({
    ok: true,
    leadId,
    deduplicado: resultado.deduplicado,
  });
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken =
    process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN;

  if (url.searchParams.get("health") === "1") {
    return Response.json(
      {
        ok: true,
        callback: new URL("/api/meta/webhook", url.origin).toString(),
        page_id: META_PAGE_ID_ESPERADA,
        form_id: META_FORM_ID_ESPERADO,
        configured: {
          verify_token: Boolean(verifyToken),
          app_secret: Boolean(process.env.META_APP_SECRET),
          page_access_token: Boolean(process.env.META_PAGE_ACCESS_TOKEN),
          supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
          supabase_service_role: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        },
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  if (
    mode === "subscribe" &&
    verifyToken &&
    token === verifyToken &&
    challenge
  ) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return Response.json({ error: "Verificacion rechazada." }, { status: 403 });
}

export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET;
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const faltantes = [
    !appSecret && "META_APP_SECRET",
    !accessToken && "META_PAGE_ACCESS_TOKEN",
    !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
    !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);

  if (faltantes.length > 0 || !appSecret || !accessToken || !supabaseUrl || !serviceRoleKey) {
    console.error("La integracion Meta Lead Ads no tiene todas sus variables.", {
      faltantes,
    });
    return Response.json({ error: "Integracion no configurada." }, { status: 503 });
  }

  const rawBody = await request.text();
  const supabase = crearSupabaseAdmin(supabaseUrl, serviceRoleKey);

  if (request.headers.get("authorization")?.startsWith("Bearer ")) {
    try {
      return await recuperarLeadAutenticado(
        request,
        rawBody,
        supabase,
        accessToken
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";

      console.error("No se pudo recuperar manualmente el lead de Meta:", {
        message,
      });

      return Response.json({ error: message }, { status: 500 });
    }
  }

  if (
    !verificarFirma(
      rawBody,
      request.headers.get("x-hub-signature-256"),
      appSecret
    )
  ) {
    console.warn("Meta webhook rechazado por firma invalida.", {
      tiene_firma: Boolean(request.headers.get("x-hub-signature-256")),
    });
    return Response.json({ error: "Firma de Meta invalida." }, { status: 401 });
  }

  let payload: MetaWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return Response.json({ error: "Payload invalido." }, { status: 400 });
  }

  const eventos = extraerEventos(payload);

  if (eventos.length === 0) {
    return Response.json({ received: true, processed: 0 });
  }

  try {
    await Promise.all(eventos.map((evento) => guardarEvento(supabase, evento)));
  } catch (error) {
    console.error("No se pudo registrar la entrega inicial de Meta:", {
      message: error instanceof Error ? error.message : "error desconocido",
    });

    return Response.json({ received: false }, { status: 500 });
  }

  console.info("Meta webhook recibido.", {
    eventos: eventos.map((evento) => ({
      lead_id: evento.leadId,
      page_id: evento.pageId,
      form_id: evento.formId,
    })),
  });

  after(async () => {
    const resultados = await Promise.allSettled(
      eventos.map((evento) => procesarEvento(supabase, evento, accessToken))
    );

    resultados.forEach((resultado, index) => {
      if (resultado.status !== "rejected") return;

      console.error("No se pudo procesar un lead de Meta:", {
        leadId: eventos[index]?.leadId,
        message:
          resultado.reason instanceof Error
            ? resultado.reason.message
            : "error desconocido",
      });
    });
  });

  return Response.json({
    received: true,
    queued: eventos.length,
  });
}
