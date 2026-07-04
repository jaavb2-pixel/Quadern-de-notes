// ============================================================
//  Connexió amb Google Drive
//  Gestiona login, desar i carregar el fitxer de notes.
//  Les credencials es llegeixen de les variables d'entorn de Vercel.
// ============================================================

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const SCOPES = "https://www.googleapis.com/auth/drive.file";
const NOM_FITXER = "quadern_notes_musica.json";

let tokenClient = null;
let accessToken = null;
let gapiInited = false;
let gisInited = false;

// --- Càrrega dinàmica dels scripts de Google ---
function carregaScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`No s'ha pogut carregar ${src}`));
    document.head.appendChild(s);
  });
}

export async function inicialitzaDrive() {
  await carregaScript("https://apis.google.com/js/api.js");
  await new Promise((resolve) => window.gapi.load("client:picker", resolve));
  await window.gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
  });
  gapiInited = true;

  await carregaScript("https://accounts.google.com/gsi/client");
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: "", // s'assigna en cada petició
  });
  gisInited = true;
}

export function estaConfigurat() {
  return Boolean(CLIENT_ID && API_KEY);
}

// --- Demana permís i obté el token ---
export function connecta() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error("Google encara no s'ha inicialitzat."));
      return;
    }
    tokenClient.callback = (resp) => {
      if (resp.error) {
        reject(new Error(resp.error));
        return;
      }
      accessToken = resp.access_token;
      window.gapi.client.setToken({ access_token: accessToken });
      resolve(accessToken);
    };
    // prompt buit: no torna a demanar consentiment si ja el té
    tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent" });
  });
}

export function estaConnectat() {
  return Boolean(accessToken);
}

export function desconnecta() {
  if (accessToken && window.google) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  if (window.gapi?.client) window.gapi.client.setToken(null);
}

// --- Cerca el fitxer de notes al Drive (per nom) ---
async function trobaFitxer() {
  const resp = await window.gapi.client.drive.files.list({
    q: `name='${NOM_FITXER}' and trashed=false`,
    fields: "files(id, name, modifiedTime)",
    spaces: "drive",
  });
  const fitxers = resp.result.files;
  return fitxers && fitxers.length ? fitxers[0] : null;
}

// --- Desa les dades: crea el fitxer si no existeix, o el sobreescriu ---
export async function desaAlDrive(dades) {
  const contingut = JSON.stringify(dades, null, 2);
  const fitxer = await trobaFitxer();
  const metadata = { name: NOM_FITXER, mimeType: "application/json" };

  const boundary = "-------quadern" + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const fi = `\r\n--${boundary}--`;

  const cos =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    contingut +
    fi;

  const metode = fitxer ? "PATCH" : "POST";
  const path = fitxer
    ? `/upload/drive/v3/files/${fitxer.id}?uploadType=multipart`
    : "/upload/drive/v3/files?uploadType=multipart";

  const resp = await window.gapi.client.request({
    path,
    method: metode,
    params: { uploadType: "multipart" },
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: cos,
  });

  return resp.result; // conté id, name…
}

// --- Carrega les dades del fitxer de notes ---
export async function carregaDelDrive() {
  const fitxer = await trobaFitxer();
  if (!fitxer) return null; // encara no hi ha cap fitxer desat
  const resp = await window.gapi.client.drive.files.get({
    fileId: fitxer.id,
    alt: "media",
  });
  try {
    return typeof resp.result === "string" ? JSON.parse(resp.result) : resp.result;
  } catch (e) {
    // gapi de vegades ja el retorna com a objecte; si no, provem el body cru
    return JSON.parse(resp.body);
  }
}
