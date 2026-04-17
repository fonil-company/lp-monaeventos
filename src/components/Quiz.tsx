import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, X, MessageCircle, Phone, Sparkles } from "lucide-react";
import { z } from "zod";

const SHEETS_URL =
  "https://script.google.com/macros/s/AKfycbyl2H5X92RWOcASdGOu2iwVTvQ5JnG1MpNVrljbekeRu6FI8UjtU8xgwMLzsLnCsYxK/exec";

function getUtms() {
  const p = new URLSearchParams(window.location.search);
  return {
    utm_source: p.get("utm_source") ?? "",
    utm_medium: p.get("utm_medium") ?? "",
    utm_campaign: p.get("utm_campaign") ?? "",
    utm_term: p.get("utm_term") ?? "",
    utm_content: p.get("utm_content") ?? "",
  };
}

async function sendLead(answers: Answers) {
  const respostas = [
    answers.occasion && `Ocasião: ${answers.occasion}`,
    answers.size && `Convidados: ${answers.size}`,
    answers.timing && `Prazo: ${answers.timing}`,
    answers.decision && `Decisor: ${answers.decision}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const payload = {
    nome: answers.name ?? "",
    email: answers.email ?? "",
    telefone: answers.whatsapp ?? "",
    evento: answers.occasion ?? "",
    respostas,
    ...getUtms(),
  };

  try {
    await fetch(SHEETS_URL, { method: "POST", body: JSON.stringify(payload), mode: "no-cors" });
  } catch {
    // falha silenciosa — lead já capturado no frontend
  }
}

function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function maskEmail(value: string): string {
  return value.replace(/[^a-zA-Z0-9@._%+\-]/g, "");
}

type Answers = {
  occasion?: string;
  size?: string;
  timing?: string;
  decision?: string;
  name?: string;
  whatsapp?: string;
  email?: string;
};

type ResultType = "hot" | "cold" | "bigwedding" | "corporate";

const occasions = [
  "Casamento / Jantar",
  "Evento corporativo",
  "Formatura",
  "Reunião / Palestra",
  "Aniversário",
  "Outro",
];
const sizes = ["Até 50", "51 a 85", "86 a 150", "Mais de 150"];
const timings = ["30 dias", "1 a 3 meses", "3 a 6 meses", "Ainda definindo"];
const decisions = ["Sim", "Estou pesquisando", "Não decido sozinho"];

const leadSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(80),
  whatsapp: z
    .string()
    .trim()
    .min(10, "WhatsApp inválido")
    .max(20)
    .regex(/^[\d\s()+-]+$/, "Use apenas números"),
  email: z.string().trim().email("E-mail inválido").max(160).optional().or(z.literal("")),
});

function computeResult(a: Answers): ResultType {
  const isWedding = a.occasion?.startsWith("Casamento");
  const isBig = a.size === "Mais de 150";
  if (isWedding && isBig) return "bigwedding";
  const urgent = a.timing === "30 dias" || a.timing === "1 a 3 meses";
  const decisive = a.decision === "Sim";
  if (a.occasion === "Evento corporativo" || a.occasion === "Formatura") return "corporate";
  if (urgent && decisive) return "hot";
  return "cold";
}

export function Quiz({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const totalSteps = 5;
  const progress = submitted ? 100 : ((step + 1) / (totalSteps + 1)) * 100;

  const close = () => {
    onClose();
    setTimeout(() => {
      setStep(0);
      setAnswers({});
      setErrors({});
      setSubmitted(false);
    }, 300);
  };

  const pick = (key: keyof Answers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setTimeout(() => setStep((s) => s + 1), 180);
  };

  const submit = async () => {
    const parsed = leadSchema.safeParse({
      name: answers.name ?? "",
      whatsapp: answers.whatsapp ?? "",
      email: answers.email ?? "",
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        errs[String(i.path[0])] = i.message;
      });
      setErrors(errs);
      return;
    }
    setErrors({});
    setSending(true);
    await sendLead(answers);
    setSending(false);
    setSubmitted(true);
  };

  const result = submitted ? computeResult(answers) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 py-6 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-background shadow-elegant">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Diagnóstico Monã
          </div>
          <button
            onClick={close}
            aria-label="Fechar"
            className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-10 sm:py-10">
          {!submitted && step === 0 && (
            <Question
              title="Qual é a ocasião?"
              options={occasions}
              selected={answers.occasion}
              onPick={(v) => pick("occasion", v)}
            />
          )}
          {!submitted && step === 1 && (
            <Question
              title="Quantas pessoas você espera?"
              options={sizes}
              selected={answers.size}
              onPick={(v) => pick("size", v)}
            />
          )}
          {!submitted && step === 2 && (
            <Question
              title="Quando está previsto o evento?"
              options={timings}
              selected={answers.timing}
              onPick={(v) => pick("timing", v)}
            />
          )}
          {!submitted && step === 3 && (
            <Question
              title="Você é quem decide a contratação?"
              options={decisions}
              selected={answers.decision}
              onPick={(v) => pick("decision", v)}
            />
          )}

          {!submitted && step === 4 && (
            <div className="space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-accent">Última etapa</p>
                <h3 className="mt-2 font-display text-3xl text-foreground">
                  Onde enviamos sua disponibilidade?
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Levamos menos de 24h para responder com pacote personalizado.
                </p>
              </div>

              <div className="space-y-4">
                <Field
                  label="Nome"
                  value={answers.name ?? ""}
                  onChange={(v) => setAnswers({ ...answers, name: v })}
                  error={errors.name}
                  placeholder="Seu nome completo"
                />
                <Field
                  label="WhatsApp"
                  value={answers.whatsapp ?? ""}
                  onChange={(v) => setAnswers({ ...answers, whatsapp: maskPhone(v) })}
                  error={errors.whatsapp}
                  placeholder="(86) 9 9999-9999"
                  inputMode="tel"
                />
                <Field
                  label="E-mail (opcional)"
                  value={answers.email ?? ""}
                  onChange={(v) => setAnswers({ ...answers, email: maskEmail(v) })}
                  error={errors.email}
                  placeholder="seu@email.com"
                  inputMode="email"
                />
              </div>

              <button
                onClick={submit}
                disabled={sending}
                className="group flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-4 text-sm font-medium text-primary-foreground shadow-gold transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sending ? "Enviando…" : "Ver disponibilidade"}
                {!sending && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
              </button>
            </div>
          )}

          {submitted && result && <Result type={result} answers={answers} />}
        </div>

        {!submitted && step > 0 && step < 5 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <span className="text-xs text-muted-foreground">
              {step + 1} / {totalSteps}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Question({
  title,
  options,
  selected,
  onPick,
}: {
  title: string;
  options: string[];
  selected?: string;
  onPick: (v: string) => void;
}) {
  return (
    <div>
      <h3 className="font-display text-2xl text-foreground sm:text-3xl">{title}</h3>
      <div className="mt-6 grid gap-3">
        {options.map((opt) => {
          const active = selected === opt;
          return (
            <button
              key={opt}
              onClick={() => onPick(opt)}
              className={`group flex items-center justify-between rounded-md border px-5 py-4 text-left text-sm transition-all ${
                active
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border bg-card text-foreground hover:border-accent/60 hover:bg-accent/5"
              }`}
            >
              <span>{opt}</span>
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                  active ? "border-accent bg-accent" : "border-border"
                }`}
              >
                {active && <Check className="h-3 w-3 text-accent-foreground" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
  inputMode?: "tel" | "email" | "text";
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1.5 w-full rounded-md border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 ${
          error ? "border-destructive" : "border-input"
        }`}
      />
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function Result({ type, answers }: { type: ResultType; answers: Answers }) {
  const name = answers.name?.split(" ")[0] ?? "";
  const waNumber = "5586999999999";

  const configs = {
    hot: {
      tag: "Disponibilidade confirmada",
      title: `${name}, temos estrutura completa para o seu evento.`,
      body: "Pelo seu perfil, conseguimos agendar uma visita esta semana e travar a data antes que outro cliente reserve. Eventos próximos costumam fechar em até 7 dias.",
      cta: "Falar agora no WhatsApp",
      icon: <MessageCircle className="h-5 w-5" />,
      action: () =>
        window.open(
          `https://wa.me/${waNumber}?text=${encodeURIComponent(
            `Olá! Sou ${name}, fiz o diagnóstico no site. ${answers.occasion} para ${answers.size} pessoas em ${answers.timing}. Quero ver disponibilidade.`,
          )}`,
        ),
    },
    cold: {
      tag: "Sem pressa, no seu tempo",
      title: `${name}, vamos te enviar os pacotes do Monã.`,
      body: "Como o evento ainda está em fase de planejamento, nosso time pode te enviar os pacotes e tirar todas as dúvidas pelo WhatsApp, quando for melhor pra você.",
      cta: "Receber materiais no WhatsApp",
      icon: <MessageCircle className="h-5 w-5" />,
      action: () =>
        window.open(
          `https://wa.me/${waNumber}?text=${encodeURIComponent(
            `Olá! Sou ${name}, fiz o diagnóstico no site do Monã.\n\n` +
            `📋 Minhas respostas:\n` +
            `• Ocasião: ${answers.occasion ?? "—"}\n` +
            `• Convidados: ${answers.size ?? "—"}\n` +
            `• Prazo: ${answers.timing ?? "—"}\n` +
            `• Decisor: ${answers.decision ?? "—"}\n\n` +
            `Gostaria de receber os pacotes e mais informações.`,
          )}`,
        ),
    },
    bigwedding: {
      tag: "Sobre capacidade",
      title: `${name}, vamos conversar com transparência.`,
      body: "Casamentos acima de 150 convidados pedem uma análise especial da nossa equipe. Conseguimos sim viabilizar — mas precisamos entender melhor sua expectativa para te apresentar o melhor formato.",
      cta: "Falar com especialista",
      icon: <Phone className="h-5 w-5" />,
      action: () =>
        window.open(
          `https://wa.me/${waNumber}?text=${encodeURIComponent(
            `Olá! Sou ${name}, estou planejando um casamento para mais de 150 pessoas. Gostaria de falar com um especialista.`,
          )}`,
        ),
    },
    corporate: {
      tag: "Pacote corporativo disponível",
      title: `${name}, temos o pacote ideal para o seu evento.`,
      body: "Para eventos corporativos e formaturas, o Monã oferece estrutura completa: salas adaptáveis, equipamento audiovisual, gastronomia inclusa e hospedagem para convidados de fora.",
      cta: "Receber proposta no WhatsApp",
      icon: <MessageCircle className="h-5 w-5" />,
      action: () =>
        window.open(
          `https://wa.me/${waNumber}?text=${encodeURIComponent(
            `Olá! Sou ${name}, fiz o diagnóstico no site. ${answers.occasion} para ${answers.size} pessoas. Quero receber a proposta.`,
          )}`,
        ),
    },
  } as const;

  const c = configs[type];

  return (
    <div className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Check className="h-7 w-7" />
      </div>
      <p className="mt-5 text-xs uppercase tracking-[0.25em] text-accent">{c.tag}</p>
      <h3 className="mt-3 font-display text-3xl text-foreground sm:text-4xl">{c.title}</h3>
      <p className="mx-auto mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
        {c.body}
      </p>
      <button
        onClick={c.action}
        className="mx-auto mt-8 flex items-center justify-center gap-2 rounded-md bg-primary px-8 py-4 text-sm font-medium text-primary-foreground shadow-gold transition-all hover:bg-primary/90 active:scale-[0.99]"
      >
        {c.icon}
        {c.cta}
      </button>
    </div>
  );
}
