import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { FINANCE_PROMPT } from "./finance-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// L'API Anthropic accepte au plus 8 images par requête dans notre configuration.
const MAX_IMAGES = 8;

const DEFAULT_CATEGORIES = [
  "Facture", "Contrat", "Rapport", "Procès-verbal", "Note de service", "Autre",
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Facture": ["facture", "montant", "total ttc", "total ht", "à payer", "paiement", "invoice"],
  "Contrat": ["contrat", "clause", "parties", "signataire", "engagement", "résiliation"],
  "Rapport": ["rapport", "synthèse", "bilan", "analyse", "conclusion"],
  "Procès-verbal": ["procès-verbal", "pv", "réunion", "ordre du jour", "présents", "absents"],
  "Note de service": ["note de service", "à l'attention de", "objet :", "diffusion"],
};

function extractLabeledValue(text: string, labels: string[]): string | null {
  const pattern = labels.join("|");
  const line = (text || "")
    .split(/\r?\n/)
    .find((l) => new RegExp(`^\\s*(?:${pattern})\\s*[:：-]`, "i").test(l));
  const value = line?.replace(new RegExp(`^\\s*(?:${pattern})\\s*[:：-]\\s*`, "i"), "").trim();
  return value || null;
}

function heuristicSummary(fileName: string, contentText: string) {
  const text = contentText || "";
  const lower = text.toLowerCase();

  let bestCategory = "Autre";
  let bestScore = 0;
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  const dateMatch = text.match(/\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2})\b/);
  const docDate = dateMatch ? dateMatch[0] : null;

  const sender = extractLabeledValue(text, ["expéditeur", "expediteur", "auteur", "de"]);
  const subject = extractLabeledValue(text, ["objet", "subject"]);

  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const summary = sentences.slice(0, 3).join(" ") || "Aucun contenu exploitable détecté sur ce document.";

  const stopwords = new Set(["dans", "avec", "pour", "cette", "sont", "être", "leur", "leurs", "nous", "vous", "elle", "ils", "elles", "plus", "tout", "tous", "toute", "toutes", "date", "objet"]);
  const freq: Record<string, number> = {};
  for (const raw of lower.match(/[a-zàâäéèêëïîôöùûüç]{5,}/g) || []) {
    if (stopwords.has(raw)) continue;
    freq[raw] = (freq[raw] || 0) + 1;
  }
  const tags = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  const titleGuess = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();

  return {
    title: titleGuess || "Document sans titre",
    category: bestCategory,
    docDate,
    sender,
    subject,
    serviceName: null,
    tags,
    summary,
    confidence: bestScore > 0 ? Math.min(0.55 + bestScore * 0.1, 0.9) : 0.4,
    fields: null,
    demo: true,
  };
}

interface ClaudeInput {
  fileName: string;
  docType: string;
  nature: string;
  contentText: string;
  imagesBase64: string[];
  imageMediaType: string;
  categories: string[];
  services: string[];
}

async function callClaude(apiKey: string, input: ClaudeInput) {
  const { fileName, docType, nature, contentText, imagesBase64, imageMediaType, categories, services } = input;

  const categoryList = (categories.length ? categories : DEFAULT_CATEGORIES).join(", ");
  const serviceInstruction = services.length
    ? `serviceName (le service concerné, choisi EXACTEMENT parmi : ${services.join(", ")} — ou null si aucun ne correspond clairement)`
    : `serviceName (toujours null)`;
  const hasImages = imagesBase64.length > 0;
  const isFinance = nature === "finance";

  const prompt = `Tu es un agent d'archivage électronique pour le Projet National de Développement Agricole (PNDA) en RDC. Analyse ce document et renvoie STRICTEMENT un objet JSON (rien d'autre, pas de markdown) avec les clés :
- title : titre court et pertinent du document
- category : la nature du document, choisie EXACTEMENT parmi : ${categoryList} (recopie le libellé à l'identique)
- docDate : la date du document au format YYYY-MM-DD (cherche-la dans l'en-tête, près de la signature, ou après un libellé "Date :" ; convertis les formats JJ/MM/AAAA ; null si vraiment introuvable)
- sender : l'expéditeur ou l'auteur du document (personne, service ou organisation émettrice — cherche l'en-tête, la signature, les mentions "Expéditeur", "De", "Auteur", le papier à en-tête ; null si introuvable)
- subject : l'objet du document (mention "Objet :" ou déduit du contenu ; null si introuvable)
- ${serviceInstruction}
- tags : tableau de 3 à 6 mots-clés en français
- summary : résumé en 2-3 phrases en français
- confidence : nombre entre 0 et 1${hasImages ? `
- extractedText : la transcription intégrale du texte lisible sur les images (chaîne vide si illisible)` : ""}${isFinance ? `
- fields : objet décrit ci-dessous (obligatoire pour ce document)` : `
- fields : toujours null`}

Nom du fichier : ${fileName}
Type suggéré : ${docType || "inconnu"}${contentText ? `
Contenu extrait du document :
\"\"\"
${contentText.slice(0, 8000)}
\"\"\"` : hasImages ? `
Le contenu est fourni sous forme d'images ci-jointes : lis-les attentivement (OCR) avant d'extraire les métadonnées.` : `
Aucun contenu textuel n'a pu être extrait : base-toi sur le nom du fichier et indique une confidence faible.`}${isFinance ? `

${FINANCE_PROMPT}` : ""}`;

  const content: unknown[] = [];
  for (const img of imagesBase64.slice(0, MAX_IMAGES)) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: imageMediaType || "image/jpeg", data: img },
    });
  }
  content.push({ type: "text", text: prompt });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: isFinance ? 8192 : (hasImages ? 4096 : 1500),
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  return { sender: null, subject: null, serviceName: null, fields: null, ...parsed, demo: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      fileName = "document",
      docType = "",
      nature = "",
      contentText = "",
      imageBase64 = null,
      imagesBase64 = null,
      imageMediaType = "image/jpeg",
      categories = [],
      services = [],
      debugCall = false,
    } = await req.json();

    const images: string[] = Array.isArray(imagesBase64) && imagesBase64.length
      ? imagesBase64.filter(Boolean)
      : (imageBase64 ? [imageBase64] : []);

    // Au-delà de MAX_IMAGES, les pages suivantes ne sont pas transmises au
    // modèle : on le signale pour que l'application lève une anomalie plutôt
    // que de laisser croire à une analyse complète.
    const pagesAnalysees = Math.min(images.length, MAX_IMAGES);
    const analysePartielle = images.length > MAX_IMAGES;

    const input: ClaudeInput = {
      fileName,
      docType,
      nature: String(nature || "").toLowerCase(),
      contentText,
      imagesBase64: images,
      imageMediaType,
      categories: Array.isArray(categories) ? categories.filter(Boolean) : [],
      services: Array.isArray(services) ? services.filter(Boolean) : [],
    };

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (debugCall) {
      if (!apiKey) {
        return new Response(JSON.stringify({ debug: "ANTHROPIC_API_KEY absente" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const r = await callClaude(apiKey, input);
        return new Response(JSON.stringify({ debug: "OK", result: r }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(JSON.stringify({ debug: "ERREUR", error: String(err) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let result;
    if (apiKey) {
      try {
        result = await callClaude(apiKey, input);
      } catch (err) {
        console.error("Claude call failed, falling back to heuristic:", err);
        result = { ...heuristicSummary(fileName, contentText), fallbackReason: String(err).slice(0, 300) };
      }
    } else {
      result = heuristicSummary(fileName, contentText);
    }

    return new Response(JSON.stringify({ ...result, pagesAnalysees, analysePartielle }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
