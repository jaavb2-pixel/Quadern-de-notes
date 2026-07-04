# Guia per posar en marxa el Quadern de notes amb Google Drive

Aquesta guia et porta de cap a cap: pujar el projecte a GitHub, desplegar-lo a
Vercel i connectar-lo amb el teu Google Drive. Els passos de Google Cloud són
els més entretinguts, però només es fan una vegada.

L'ordre recomanat és: primer Vercel (per tindre l'adreça web), després Google
Cloud (que necessita eixa adreça), i finalment tornar a Vercel per posar-hi les
claus.

---

## Part 1 · Pujar el projecte a GitHub

1. Crea un repositori nou al teu compte de GitHub (pot ser privat).
2. Puja-hi tot el contingut d'aquesta carpeta.
3. **Important:** no pugis mai el fitxer `.env.local` si el crees (ja està
   exclòs pel `.gitignore`). Les claus van a Vercel, no al codi.

---

## Part 2 · Desplegar a Vercel (primera passada)

1. A Vercel, «Add New… > Project» i importa el repositori de GitHub.
2. Vercel detectarà que és un projecte Vite automàticament. No cal tocar res.
3. Fes «Deploy». En acabar, tindràs una adreça del tipus
   `https://el-teu-projecte.vercel.app`.
4. **Apunta't eixa adreça**: la necessitaràs ara a Google Cloud.

De moment l'app carregarà, però encara no es podrà connectar a Drive: li falten
les claus. Anem a generar-les.

---

## Part 3 · Google Cloud Console (les credencials)

Ves a https://console.cloud.google.com amb el teu compte de Google.

### 3.1 · Crear un projecte
- A dalt, al selector de projectes, «Projecte nou». Posa-li un nom (per exemple
  «Quadern notes») i crea'l. Assegura't que queda seleccionat.

### 3.2 · Activar l'API de Google Drive
- Menú ☰ > «API i serveis» > «Biblioteca».
- Busca «Google Drive API», entra-hi i prem «Habilita».

### 3.3 · Configurar la pantalla de consentiment
- Menú ☰ > «API i serveis» > «Pantalla de consentiment d'OAuth»
  (o «Google Auth Platform» > «Overview», segons la versió).
- Prem «Comença» / «Get started».
- Tipus d'usuari: tria **Extern**.
- Emplena el nom de l'app (p. ex. «Quadern de notes»), el teu correu de suport i
  el correu de contacte. La resta pots deixar-ho per defecte.
- Accepta la política i desa.
- A l'apartat **Usuaris de prova** («Test users»), afig el teu propi correu de
  Google. Això és clau: mentre l'app estiga en mode prova, només els correus que
  hi afiges podran entrar-hi. Amb el teu n'hi ha prou.

### 3.4 · Crear la clau d'API (API key)
- Menú ☰ > «API i serveis» > «Credencials».
- «Crea credencials» > «Clau d'API».
- Es genera una clau. **Copia-la** (la necessitaràs com a `VITE_GOOGLE_API_KEY`).
- Recomanat: prem «Restringeix la clau» i, a «Restriccions d'API», limita-la a
  «Google Drive API».

### 3.5 · Crear l'identificador de client (OAuth Client ID)
- A la mateixa pàgina de credencials: «Crea credencials» > «ID de client d'OAuth».
- Tipus d'aplicació: **Aplicació web**.
- Posa-li un nom.
- A **Orígens de JavaScript autoritzats**, prem «Afig un URI» i posa'n dos:
  - `http://localhost:5173` (per provar-ho al teu ordinador, opcional)
  - L'adreça de Vercel que has apuntat abans, per exemple
    `https://el-teu-projecte.vercel.app` (sense barra al final).
- Prem «Crea». Es mostrarà l'**ID de client**. **Copia'l** (serà
  `VITE_GOOGLE_CLIENT_ID`). El «client secret» que també apareix NO el necessites.

> Si més endavant Vercel et dona una adreça nova (per exemple un domini propi),
> hauràs de tornar ací i afegir-la als orígens autoritzats.

---

## Part 4 · Posar les claus a Vercel

1. Al teu projecte de Vercel: «Settings» > «Environment Variables».
2. Afig aquestes dues variables (els noms han de ser exactes):

   | Nom | Valor |
   |-----|-------|
   | `VITE_GOOGLE_CLIENT_ID` | l'ID de client acabat en `.apps.googleusercontent.com` |
   | `VITE_GOOGLE_API_KEY` | la clau d'API |

3. Desa-les i torna a desplegar («Deployments» > el darrer > «Redeploy»), perquè
   les variables s'apliquen en el desplegament.

---

## Part 5 · Provar-ho

1. Obri l'adreça de Vercel.
2. Prem «Connectar amb Google Drive» i entra amb el teu compte (el que has posat
   com a usuari de prova).
3. Google et mostrarà un avís que l'app no està verificada: com que ets tu el
   propietari i estàs a la llista de prova, prem «Continua» / «Avançat > Anar a
   l'app». És normal en apps personals no publicades.
4. Fes un canvi de prova i prem «Desar». Ves al teu Drive i comprova que hi ha el
   fitxer `quadern_notes_musica.json`.
5. Tanca i torna a obrir: en connectar, hauria de recuperar les dades.

---

## Notes importants

- **Les teues dades viuen al teu Drive**, en un únic fitxer. L'app només pot
  veure els fitxers que ella mateixa crea (permís `drive.file`), no la resta del
  teu Drive. És el permís mínim i més segur.
- **Privadesa de l'alumnat:** com que és el teu Drive personal (no l'institucional),
  considera usar inicials o codis en compte de noms complets.
- **Còpia de seguretat:** de tant en tant, pots fer una còpia manual del fitxer
  des del mateix Drive, per si de cas.
- Si algun dia vols que altres persones hi entren, hauràs d'afegir els seus
  correus com a usuaris de prova, o publicar l'app (procés a part).
