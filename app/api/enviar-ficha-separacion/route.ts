export const runtime = "nodejs";

type Payload = {
  to?: string;
  subject?: string;
  message?: string;
  fileName?: string;
  pdfBase64?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as Payload;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (
    !payload.to ||
    !payload.subject ||
    !payload.fileName ||
    !payload.pdfBase64
  ) {
    return Response.json(
      {
        error:
          "Faltan datos para enviar la ficha por correo.",
      },
      {
        status: 400,
      }
    );
  }

  if (!apiKey || !from) {
    return Response.json(
      {
        error:
          "Falta configurar RESEND_API_KEY y MAIL_FROM en Vercel para enviar PDFs por correo.",
      },
      {
        status: 500,
      }
    );
  }

  const response = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        text:
          payload.message ||
          "Adjuntamos la ficha de separacion.",
        attachments: [
          {
            filename: payload.fileName,
            content: payload.pdfBase64,
          },
        ],
      }),
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    return Response.json(
      {
        error:
          data?.message ||
          "No se pudo enviar el correo.",
      },
      {
        status: response.status,
      }
    );
  }

  return Response.json({
    ok: true,
    data,
  });
}

