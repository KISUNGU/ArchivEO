import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Extrait le texte d'un PDF numérique (avec calque texte). Un PDF issu d'un scan
// image pur (sans OCR préalable) ne contient aucun texte extractible : dans ce cas
// la fonction renvoie une chaîne vide, ce qui est normal et attendu.
export async function extractPdfText(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return { text: text.trim(), pageCount: pdf.numPages };
}

// Rend la première page d'un PDF en image (data URL PNG) pour l'aperçu d'import.
export async function renderPdfFirstPage(file, maxWidth = 480) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(2, maxWidth / baseViewport.width);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas.toDataURL('image/png');
}

// Rend les premières pages d'un PDF scanné (sans calque texte) en images JPEG base64,
// pour que l'agent IA puisse les lire par vision (OCR) et pré-remplir la fiche.
export async function renderPdfPagesAsBase64(file, maxPages = 4, maxWidth = 1100) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageCount = Math.min(pdf.numPages, maxPages);
  const imagesBase64 = [];
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, maxWidth / baseViewport.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    imagesBase64.push(dataUrl.split(',')[1]);
  }
  return { imagesBase64, mediaType: 'image/jpeg' };
}
