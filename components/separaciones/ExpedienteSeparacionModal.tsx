"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../../lib/supabase";
import {
  TIPOS_DOCUMENTO_SEPARACION,
  esGerencia,
  etiquetaEstadoExpediente,
  etiquetaTipoDocumentoSeparacion,
  formatearMoneda,
  nombreCliente,
  type Cliente,
  type DocumentoSeparacion,
  type ExpedienteSeparacion,
  type LoteCrm,
  type Profile,
  type Separacion,
  type TipoDocumentoSeparacion,
} from "../../lib/crm";

const BUCKET_EXPEDIENTES = "crm-expedientes";
const MAX_ARCHIVO_BYTES = 10 * 1024 * 1024;
const MIME_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

type ExpedienteForm = {
  monto: string;
  fecha: string;
  banco: string;
  operacion: string;
  observaciones: string;
};

type Props = {
  separacion: Separacion;
  lote: LoteCrm | null;
  cliente: Cliente | null;
  profile: Profile;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
};

const formatearTamano = (bytes: number) => {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const colorExpediente = (estado?: string | null) => {
  switch (estado) {
    case "VALIDADO":
      return "expediente-status expediente-status--validated";
    case "EN_REVISION":
      return "expediente-status expediente-status--review";
    case "OBSERVADO":
      return "expediente-status expediente-status--observed";
    default:
      return "expediente-status expediente-status--incomplete";
  }
};

const nombreSeguro = (nombre: string) => {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return limpio || "documento";
};

export default function ExpedienteSeparacionModal({
  separacion,
  lote,
  cliente,
  profile,
  onClose,
  onChanged,
}: Props) {
  const [expediente, setExpediente] =
    useState<ExpedienteSeparacion | null>(null);
  const [documentos, setDocumentos] = useState<
    DocumentoSeparacion[]
  >([]);
  const [form, setForm] = useState<ExpedienteForm>({
    monto:
      separacion.monto_separacion?.toFixed(2) || "",
    fecha: "",
    banco: "",
    operacion: "",
    observaciones: "",
  });
  const [tipoDocumento, setTipoDocumento] =
    useState<TipoDocumentoSeparacion>("DNI");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [archivoKey, setArchivoKey] = useState(0);
  const [motivoRevision, setMotivoRevision] =
    useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const modoGerencia = esGerencia(profile);
  const estado = expediente?.estado || "INCOMPLETO";
  const editable = !["EN_REVISION", "VALIDADO"].includes(
    estado
  );

  const cargar = useCallback(async () => {
    if (!supabase) return;

    setCargando(true);
    setError(null);

    const [expedienteRes, documentosRes] = await Promise.all([
      supabase
        .from("separacion_expedientes")
        .select(
          "separacion_id,cliente_id,lote_id,asesor_id,estado,pago_monto,pago_fecha,pago_banco,pago_operacion,observaciones,enviado_revision_at,revisado_por,revisado_at,motivo_revision,created_by,created_at,updated_at"
        )
        .eq("separacion_id", separacion.id)
        .maybeSingle(),
      supabase
        .from("separacion_documentos")
        .select(
          "id,separacion_id,cliente_id,lote_id,asesor_id,tipo,storage_path,nombre_archivo,mime_type,tamano_bytes,estado,observaciones,subido_por,revisado_por,revisado_at,created_at,updated_at"
        )
        .eq("separacion_id", separacion.id)
        .order("created_at", { ascending: false }),
    ]);

    if (expedienteRes.error || documentosRes.error) {
      setError(
        expedienteRes.error?.message ||
          documentosRes.error?.message ||
          "No se pudo cargar el expediente."
      );
      setCargando(false);
      return;
    }

    const expedienteActual =
      (expedienteRes.data as ExpedienteSeparacion | null) ||
      null;

    setExpediente(expedienteActual);
    setDocumentos(
      (documentosRes.data || []) as DocumentoSeparacion[]
    );

    if (expedienteActual) {
      setForm({
        monto:
          expedienteActual.pago_monto === null
            ? ""
            : Number(expedienteActual.pago_monto).toFixed(2),
        fecha: expedienteActual.pago_fecha || "",
        banco: expedienteActual.pago_banco || "",
        operacion: expedienteActual.pago_operacion || "",
        observaciones: expedienteActual.observaciones || "",
      });
      setMotivoRevision(
        expedienteActual.motivo_revision || ""
      );
    }

    setCargando(false);
  }, [separacion.id]);

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, [cargar]);

  useEffect(() => {
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !procesando && !subiendo) {
        onClose();
      }
    };

    document.addEventListener("keydown", cerrarConEscape);
    return () =>
      document.removeEventListener("keydown", cerrarConEscape);
  }, [onClose, procesando, subiendo]);

  const requisitos = useMemo(() => {
    const datosPago = Boolean(
      Number(form.monto) > 0 &&
        form.fecha &&
        form.banco.trim() &&
        form.operacion.trim()
    );
    const dni = documentos.some(
      (documento) =>
        documento.tipo === "DNI" &&
        documento.estado !== "RECHAZADO"
    );
    const voucher = documentos.some(
      (documento) =>
        ["VOUCHER_SEPARACION", "VOUCHER_INICIAL"].includes(
          documento.tipo
        ) && documento.estado !== "RECHAZADO"
    );

    return { datosPago, dni, voucher };
  }, [documentos, form]);

  const actualizarForm = (
    campo: keyof ExpedienteForm,
    valor: string
  ) => {
    setForm((actual) => ({ ...actual, [campo]: valor }));
  };

  const guardarDatos = async (notificar = true) => {
    if (!supabase || !editable) return false;

    setGuardando(true);
    setError(null);
    if (notificar) setMensaje(null);

    const monto = form.monto.trim()
      ? Number(form.monto)
      : null;

    if (monto !== null && (!Number.isFinite(monto) || monto < 0)) {
      setError("Ingresa un monto de pago valido.");
      setGuardando(false);
      return false;
    }

    const { error: rpcError } = await supabase.rpc(
      "crm_guardar_expediente_separacion",
      {
        p_separacion_id: separacion.id,
        p_pago_monto: monto,
        p_pago_fecha: form.fecha || null,
        p_pago_banco: form.banco.trim() || null,
        p_pago_operacion: form.operacion.trim() || null,
        p_observaciones: form.observaciones.trim() || null,
      }
    );

    if (rpcError) {
      setError(rpcError.message);
      setGuardando(false);
      return false;
    }

    if (notificar) {
      setMensaje("Datos del expediente guardados.");
    }
    await cargar();
    await onChanged();
    setGuardando(false);
    return true;
  };

  const subirDocumento = async () => {
    if (!supabase || !archivo || !editable) return;

    setError(null);
    setMensaje(null);

    if (!MIME_PERMITIDOS.includes(archivo.type)) {
      setError("Adjunta un PDF, JPG, PNG o WEBP.");
      return;
    }

    if (archivo.size <= 0 || archivo.size > MAX_ARCHIVO_BYTES) {
      setError("El archivo debe pesar como maximo 10 MB.");
      return;
    }

    setSubiendo(true);

    const ruta = `${separacion.id}/${crypto.randomUUID()}-${nombreSeguro(
      archivo.name
    )}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_EXPEDIENTES)
      .upload(ruta, archivo, {
        contentType: archivo.type,
        upsert: false,
      });

    if (uploadError) {
      setError(uploadError.message);
      setSubiendo(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc(
      "crm_registrar_documento_separacion",
      {
        p_separacion_id: separacion.id,
        p_tipo: tipoDocumento,
        p_storage_path: ruta,
        p_nombre_archivo: archivo.name,
        p_mime_type: archivo.type,
        p_tamano_bytes: archivo.size,
      }
    );

    if (rpcError) {
      await supabase.storage
        .from(BUCKET_EXPEDIENTES)
        .remove([ruta]);
      setError(rpcError.message);
      setSubiendo(false);
      return;
    }

    setArchivo(null);
    setArchivoKey((actual) => actual + 1);
    setMensaje("Documento adjuntado al expediente.");
    await cargar();
    await onChanged();
    setSubiendo(false);
  };

  const verDocumento = async (
    documento: DocumentoSeparacion
  ) => {
    if (!supabase) return;

    setError(null);
    const { data, error: signedError } = await supabase.storage
      .from(BUCKET_EXPEDIENTES)
      .createSignedUrl(documento.storage_path, 120);

    if (signedError || !data?.signedUrl) {
      setError(
        signedError?.message || "No se pudo abrir el documento."
      );
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const eliminarDocumento = async (
    documento: DocumentoSeparacion
  ) => {
    if (!supabase || !editable) return;
    if (!window.confirm("Eliminar este documento del expediente?")) {
      return;
    }

    setProcesando(true);
    setError(null);
    setMensaje(null);

    const { data, error: rpcError } = await supabase.rpc(
      "crm_eliminar_documento_separacion",
      { p_documento_id: documento.id }
    );

    if (rpcError) {
      setError(rpcError.message);
      setProcesando(false);
      return;
    }

    const ruta = typeof data === "string" ? data : documento.storage_path;
    const { error: storageError } = await supabase.storage
      .from(BUCKET_EXPEDIENTES)
      .remove([ruta]);

    if (storageError) {
      setError(
        `El registro se elimino, pero Storage respondio: ${storageError.message}`
      );
    } else {
      setMensaje("Documento eliminado.");
    }

    await cargar();
    await onChanged();
    setProcesando(false);
  };

  const enviarRevision = async () => {
    if (!supabase || !editable) return;

    const guardado = await guardarDatos(false);
    if (!guardado) return;

    setProcesando(true);
    setError(null);
    setMensaje(null);

    const { error: rpcError } = await supabase.rpc(
      "crm_enviar_expediente_revision",
      { p_separacion_id: separacion.id }
    );

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMensaje("Expediente enviado a revision de gerencia.");
      await cargar();
      await onChanged();
    }

    setProcesando(false);
  };

  const revisarExpediente = async (
    resultado: "VALIDADO" | "OBSERVADO"
  ) => {
    if (!supabase || !modoGerencia || estado !== "EN_REVISION") {
      return;
    }

    if (
      resultado === "OBSERVADO" &&
      motivoRevision.trim().length < 5
    ) {
      setError("Describe la observacion antes de devolver el expediente.");
      return;
    }

    setProcesando(true);
    setError(null);
    setMensaje(null);

    const { error: rpcError } = await supabase.rpc(
      "crm_revisar_expediente_separacion",
      {
        p_separacion_id: separacion.id,
        p_estado: resultado,
        p_motivo:
          resultado === "OBSERVADO"
            ? motivoRevision.trim()
            : null,
      }
    );

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMensaje(
        resultado === "VALIDADO"
          ? "Expediente validado por gerencia."
          : "Expediente observado y devuelto al asesor."
      );
      await cargar();
      await onChanged();
    }

    setProcesando(false);
  };

  return (
    <div
      className="expediente-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expediente-title"
    >
      <div className="expediente-modal">
        <header className="expediente-header">
          <div>
            <span className="expediente-eyebrow">
              Expediente de separacion
            </span>
            <h2 id="expediente-title">
              {lote
                ? `MZ ${lote.mz} - Lote ${lote.lote}`
                : "Separacion"}
            </h2>
            <p>
              {nombreCliente(cliente) || "Cliente sin identificar"}
              {separacion.fecha_limite
                ? ` | Vence ${new Date(
                    `${separacion.fecha_limite}T12:00:00`
                  ).toLocaleDateString("es-PE")}`
                : ""}
            </p>
          </div>
          <div className="expediente-header-actions">
            <span className={colorExpediente(estado)}>
              {etiquetaEstadoExpediente(estado)}
            </span>
            <button
              type="button"
              className="expediente-icon-button"
              onClick={onClose}
              aria-label="Cerrar expediente"
              title="Cerrar"
            >
              x
            </button>
          </div>
        </header>

        <div className="expediente-body">
          {cargando ? (
            <div className="expediente-loading">Cargando expediente...</div>
          ) : (
            <>
              {mensaje && (
                <div className="expediente-message expediente-message--success">
                  {mensaje}
                </div>
              )}
              {error && (
                <div className="expediente-message expediente-message--error">
                  {error}
                </div>
              )}

              {expediente?.motivo_revision && (
                <div className="expediente-observation">
                  <strong>Observacion de gerencia</strong>
                  <span>{expediente.motivo_revision}</span>
                </div>
              )}

              <section className="expediente-section">
                <div className="expediente-section-heading">
                  <div>
                    <h3>Pago reportado</h3>
                    <p>
                      Separacion registrada: {formatearMoneda(
                        separacion.monto_separacion || 0
                      )}
                    </p>
                  </div>
                </div>

                <div className="expediente-form-grid">
                  <label>
                    Monto pagado
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.monto}
                      disabled={!editable}
                      onChange={(event) =>
                        actualizarForm("monto", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Fecha de pago
                    <input
                      type="date"
                      value={form.fecha}
                      disabled={!editable}
                      onChange={(event) =>
                        actualizarForm("fecha", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Banco o medio de pago
                    <input
                      type="text"
                      value={form.banco}
                      disabled={!editable}
                      onChange={(event) =>
                        actualizarForm("banco", event.target.value)
                      }
                      placeholder="Interbank, efectivo..."
                    />
                  </label>
                  <label>
                    Numero de operacion
                    <input
                      type="text"
                      value={form.operacion}
                      disabled={!editable}
                      onChange={(event) =>
                        actualizarForm("operacion", event.target.value)
                      }
                      placeholder="Codigo o constancia"
                    />
                  </label>
                </div>

                <label className="expediente-field-wide">
                  Observaciones internas
                  <textarea
                    value={form.observaciones}
                    disabled={!editable}
                    onChange={(event) =>
                      actualizarForm(
                        "observaciones",
                        event.target.value
                      )
                    }
                  />
                </label>
              </section>

              <section className="expediente-section">
                <div className="expediente-section-heading">
                  <div>
                    <h3>Documentos</h3>
                    <p>Archivos privados del comprador y del pago.</p>
                  </div>
                </div>

                {editable && (
                  <div className="expediente-upload-row">
                    <select
                      value={tipoDocumento}
                      onChange={(event) =>
                        setTipoDocumento(
                          event.target.value as TipoDocumentoSeparacion
                        )
                      }
                      aria-label="Tipo de documento"
                    >
                      {TIPOS_DOCUMENTO_SEPARACION.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {etiquetaTipoDocumentoSeparacion(tipo)}
                        </option>
                      ))}
                    </select>
                    <input
                      key={archivoKey}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                      onChange={(event) =>
                        setArchivo(event.target.files?.[0] || null)
                      }
                      aria-label="Seleccionar documento"
                    />
                    <button
                      type="button"
                      className="expediente-button expediente-button--secondary"
                      disabled={!archivo || subiendo}
                      onClick={subirDocumento}
                    >
                      {subiendo ? "Subiendo..." : "Adjuntar"}
                    </button>
                  </div>
                )}

                <div className="expediente-documents">
                  {documentos.map((documento) => (
                    <div
                      className="expediente-document-row"
                      key={documento.id}
                    >
                      <div>
                        <strong>
                          {etiquetaTipoDocumentoSeparacion(
                            documento.tipo
                          )}
                        </strong>
                        <span>
                          {documento.nombre_archivo} | {formatearTamano(
                            documento.tamano_bytes
                          )}
                        </span>
                      </div>
                      <span className="expediente-document-state">
                        {documento.estado.replaceAll("_", " ")}
                      </span>
                      <div className="expediente-document-actions">
                        <button
                          type="button"
                          onClick={() => verDocumento(documento)}
                        >
                          Ver
                        </button>
                        {editable && documento.estado !== "VALIDADO" && (
                          <button
                            type="button"
                            className="expediente-link-danger"
                            disabled={procesando}
                            onClick={() =>
                              eliminarDocumento(documento)
                            }
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {documentos.length === 0 && (
                    <div className="expediente-empty">
                      Sin documentos adjuntos.
                    </div>
                  )}
                </div>
              </section>

              <section className="expediente-review-strip">
                <div className={requisitos.datosPago ? "is-ready" : ""}>
                  <span aria-hidden="true">
                    {requisitos.datosPago ? "OK" : "-"}
                  </span>
                  Datos de pago
                </div>
                <div className={requisitos.dni ? "is-ready" : ""}>
                  <span aria-hidden="true">
                    {requisitos.dni ? "OK" : "-"}
                  </span>
                  DNI
                </div>
                <div className={requisitos.voucher ? "is-ready" : ""}>
                  <span aria-hidden="true">
                    {requisitos.voucher ? "OK" : "-"}
                  </span>
                  Voucher
                </div>
              </section>

              {modoGerencia && estado === "EN_REVISION" && (
                <section className="expediente-manager-review">
                  <label>
                    Observacion para el asesor
                    <textarea
                      value={motivoRevision}
                      onChange={(event) =>
                        setMotivoRevision(event.target.value)
                      }
                      placeholder="Obligatoria solo al observar"
                    />
                  </label>
                  <div>
                    <button
                      type="button"
                      className="expediente-button expediente-button--danger"
                      disabled={procesando}
                      onClick={() => revisarExpediente("OBSERVADO")}
                    >
                      Observar
                    </button>
                    <button
                      type="button"
                      className="expediente-button expediente-button--primary"
                      disabled={procesando}
                      onClick={() => revisarExpediente("VALIDADO")}
                    >
                      Validar expediente
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <footer className="expediente-footer">
          <button
            type="button"
            className="expediente-button expediente-button--ghost"
            onClick={onClose}
          >
            Cerrar
          </button>
          {editable && !cargando && (
            <>
              <button
                type="button"
                className="expediente-button expediente-button--secondary"
                disabled={guardando || procesando || subiendo}
                onClick={() => guardarDatos()}
              >
                {guardando ? "Guardando..." : "Guardar borrador"}
              </button>
              <button
                type="button"
                className="expediente-button expediente-button--primary"
                disabled={guardando || procesando || subiendo}
                onClick={enviarRevision}
              >
                {procesando ? "Enviando..." : "Enviar a revision"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
